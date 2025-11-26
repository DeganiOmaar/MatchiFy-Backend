import { Injectable, Logger, ServiceUnavailableException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AiResponse } from './ai.service';

export interface OllamaConfig {
  url: string;
  model: string;
  timeout: number;
}

@Injectable()
export class OllamaService {
  private readonly logger = new Logger(OllamaService.name);
  private config: OllamaConfig;
  private isAvailableCache: boolean | null = null;
  private lastCheckTime: number = 0;
  private readonly HEALTH_CHECK_CACHE_MS = 60000; // Cache health check for 1 minute

  constructor(private configService: ConfigService) {
    const url = this.configService.get<string>('AI_LOCAL_URL', 'http://localhost:7007/analyze');
    const model = this.configService.get<string>('AI_MODEL', 'llama3.1');
    const timeout = parseInt(this.configService.get<string>('AI_TIMEOUT', '30000'), 10);

    this.config = {
      url,
      model,
      timeout,
    };

    this.logger.log(`Ollama service initialized with URL: ${this.config.url}, Model: ${this.config.model}`);
  }

  /**
   * Check if Ollama service is available
   */
  isAvailable(): boolean {
    // Use cached result if available and recent
    const now = Date.now();
    if (this.isAvailableCache !== null && (now - this.lastCheckTime) < this.HEALTH_CHECK_CACHE_MS) {
      return this.isAvailableCache;
    }

    // For now, assume it's available if configured
    // We'll do actual health checks during requests
    this.isAvailableCache = true;
    this.lastCheckTime = now;
    return true;
  }

  /**
   * Generate content using Ollama API
   */
  async generateContent(
    prompt: string,
    options?: {
      temperature?: number;
      maxTokens?: number;
    },
  ): Promise<AiResponse> {
    const startTime = Date.now();

    try {
      this.logger.debug(`Sending request to Ollama (model: ${this.config.model})`);

      // Check if we're using Ollama native API or a wrapper service
      const isOllamaNative = this.config.url.includes('/api/generate');
      
      // Prepare request body based on API type
      const requestBody = isOllamaNative
        ? {
            model: this.config.model,
            prompt,
            stream: false,
            options: {
              ...(options?.temperature !== undefined && { temperature: options.temperature }),
              ...(options?.maxTokens !== undefined && { num_predict: options.maxTokens }),
            },
          }
        : {
            prompt,
            model: this.config.model,
            ...(options?.temperature !== undefined && { temperature: options.temperature }),
            ...(options?.maxTokens !== undefined && { max_tokens: options.maxTokens }),
          };

      // Create AbortController for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        controller.abort();
      }, this.config.timeout);

      try {
        const response = await fetch(this.config.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        // Check if request was aborted (timeout)
        if (controller.signal.aborted) {
          throw new ServiceUnavailableException(
            'AI service request timed out. Please try again later.',
          );
        }

        // Check response status
        if (!response.ok) {
          const errorText = await response.text().catch(() => 'Unknown error');
          
          if (response.status === 503 || response.status === 502) {
            this.isAvailableCache = false;
            throw new ServiceUnavailableException(
              'AI service is temporarily unavailable. Please try again later.',
            );
          }

          if (response.status === 400) {
            throw new BadRequestException(
              'Invalid request to AI service.',
            );
          }

          this.logger.error(`Ollama API returned error ${response.status}: ${errorText}`);
          throw new ServiceUnavailableException(
            'AI service is temporarily unavailable. Please try again later.',
          );
        }

        // Parse response
        const responseData = await response.json();
        const elapsed = Date.now() - startTime;

        // Extract text from response (adapt based on API type)
        let text: string;
        let usage: { promptTokens?: number; completionTokens?: number } | undefined;

        if (isOllamaNative) {
          // Ollama native API format
          text = responseData.response || '';
          usage = {
            promptTokens: responseData.prompt_eval_count,
            completionTokens: responseData.eval_count,
          };
        } else {
          // Wrapper service format
          if (typeof responseData === 'string') {
            text = responseData;
          } else if (responseData.text) {
            text = responseData.text;
          } else if (responseData.response) {
            text = responseData.response;
          } else if (responseData.content) {
            text = responseData.content;
          } else if (responseData.message?.content) {
            text = responseData.message.content;
          } else {
            // Fallback: try to stringify the whole response
            text = JSON.stringify(responseData);
            this.logger.warn('Unexpected response format, using stringified response');
          }

          // Extract usage if available
          usage = responseData.usage ? {
            promptTokens: responseData.usage.prompt_tokens || responseData.usage.promptTokens,
            completionTokens: responseData.usage.completion_tokens || responseData.usage.completionTokens,
          } : undefined;
        }

        this.logger.log(
          `Ollama request completed in ${elapsed}ms${usage ? ` (tokens: ${usage.promptTokens || '?'}+${usage.completionTokens || '?'})` : ''}`,
        );

        this.isAvailableCache = true;
        this.lastCheckTime = Date.now();

        return {
          text,
          usage,
        };
      } catch (fetchError: any) {
        clearTimeout(timeoutId);

        // Handle abort (timeout)
        if (fetchError.name === 'AbortError' || controller.signal.aborted) {
          throw new ServiceUnavailableException(
            'AI service request timed out. Please try again later.',
          );
        }

        // Handle network errors
        const errorCode = fetchError.cause?.code || fetchError.code;
        const errorMessage = fetchError.message || '';
        
        if (
          errorCode === 'ECONNREFUSED' ||
          errorMessage.includes('ECONNREFUSED') ||
          errorMessage.includes('fetch failed') ||
          errorMessage.includes('connect ECONNREFUSED')
        ) {
          this.isAvailableCache = false;
          this.logger.error(
            `Failed to connect to Ollama server at ${this.config.url}. Please ensure:`,
          );
          this.logger.error(`1. Ollama server is running`);
          this.logger.error(`2. URL is correct: ${this.config.url}`);
          this.logger.error(`3. Port ${new URL(this.config.url).port || 'default'} is accessible`);
          
          throw new ServiceUnavailableException(
            'AI service is temporarily unavailable. Please ensure the local Ollama server is running.',
          );
        }

        // Log the full error for debugging
        this.logger.error(`Ollama fetch error: ${errorMessage}`, {
          code: errorCode,
          url: this.config.url,
          stack: fetchError.stack,
        });

        throw fetchError;
      }
    } catch (error: any) {
      const elapsed = Date.now() - startTime;
      
      // Re-throw ServiceUnavailableException and BadRequestException as-is
      if (error instanceof ServiceUnavailableException || error instanceof BadRequestException) {
        throw error;
      }

      this.logger.error(
        `Ollama request failed after ${elapsed}ms: ${error.message}`,
        error.stack,
      );

      // Mark as unavailable on network errors
      if (error.message?.includes('unavailable') || error.message?.includes('ECONNREFUSED')) {
        this.isAvailableCache = false;
      }

      throw new ServiceUnavailableException(
        'AI service is temporarily unavailable. Please try again later.',
      );
    }
  }
}


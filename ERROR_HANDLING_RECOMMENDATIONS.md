# Recommandations pour l'amélioration de la gestion des erreurs backend

## Vue d'ensemble

Le frontend (iOS et Android) a été mis à jour pour afficher des messages d'erreur conviviaux. Pour optimiser cette expérience, le backend devrait retourner des réponses d'erreur structurées et cohérentes.

## Format recommandé pour les réponses d'erreur

### Structure JSON standardisée

Toutes les réponses d'erreur devraient suivre ce format :

```json
{
  "message": "Message d'erreur convivial pour l'utilisateur",
  "error": "Code d'erreur technique (optionnel)",
  "statusCode": 400
}
```

### Exemples par code HTTP

#### 400 Bad Request
```json
{
  "message": "Veuillez remplir tous les champs requis.",
  "error": "VALIDATION_ERROR",
  "statusCode": 400
}
```

#### 401 Unauthorized
```json
{
  "message": "Email ou mot de passe incorrect.",
  "error": "INVALID_CREDENTIALS",
  "statusCode": 401
}
```

#### 404 Not Found
```json
{
  "message": "Mission introuvable.",
  "error": "MISSION_NOT_FOUND",
  "statusCode": 404
}
```

#### 409 Conflict
```json
{
  "message": "Un compte existe déjà avec cet email.",
  "error": "EMAIL_ALREADY_EXISTS",
  "statusCode": 409
}
```

#### 422 Unprocessable Entity
```json
{
  "message": "Les données fournies ne sont pas valides.",
  "error": "VALIDATION_FAILED",
  "statusCode": 422
}
```

#### 500 Internal Server Error
```json
{
  "message": "Le serveur rencontre un problème. Veuillez réessayer plus tard.",
  "error": "INTERNAL_SERVER_ERROR",
  "statusCode": 500
}
```

## Champs de message supportés

Le frontend cherche les messages d'erreur dans cet ordre :
1. `message` (priorité)
2. `error`
3. `msg`

## Messages spécifiques recommandés

### Authentification

- **Login échoué** : `"Email ou mot de passe incorrect."`
- **Token manquant** : `"Vous devez être connecté pour effectuer cette action."`
- **Token expiré** : `"Votre session a expiré. Veuillez vous reconnecter."`

### Validation

- **Champs requis manquants** : `"Veuillez remplir tous les champs requis."`
- **Email invalide** : `"Format d'email invalide."`
- **Mot de passe faible** : `"Le mot de passe doit contenir au moins 6 caractères."`
- **Mots de passe ne correspondent pas** : `"Les mots de passe ne correspondent pas."`

### Ressources

- **Mission introuvable** : `"Mission introuvable."`
- **Profil introuvable** : `"Profil introuvable."`
- **Permission refusée** : `"Vous n'avez pas la permission d'effectuer cette action."`

### Conflits

- **Email déjà utilisé** : `"Un compte existe déjà avec cet email."`
- **Ressource existe déjà** : `"Cette ressource existe déjà."`

## Implémentation NestJS recommandée

### Exception Filter personnalisé

```typescript
import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Une erreur s\'est produite. Veuillez réessayer.';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      
      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (typeof exceptionResponse === 'object' && 'message' in exceptionResponse) {
        message = Array.isArray(exceptionResponse.message) 
          ? exceptionResponse.message[0] 
          : exceptionResponse.message;
      }
    }

    response.status(status).json({
      message,
      statusCode: status,
      timestamp: new Date().toISOString(),
    });
  }
}
```

### Utilisation dans main.ts

```typescript
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalFilters(new AllExceptionsFilter());
  await app.listen(3000);
}
bootstrap();
```

## Avantages

1. **Cohérence** : Tous les endpoints retournent le même format
2. **Expérience utilisateur** : Messages clairs et compréhensibles
3. **Maintenance** : Facile à mettre à jour et à étendre
4. **Debugging** : Le champ `error` permet le debugging technique

## Notes importantes

- Les messages doivent être en **français** pour correspondre au frontend
- Évitez les messages techniques comme "Unauthorized", "Bad Request", etc.
- Privilégiez des messages qui guident l'utilisateur vers la solution


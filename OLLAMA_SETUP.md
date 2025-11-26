# Configuration Ollama pour l'Analyse de Profil AI

Ce guide explique comment configurer et démarrer le serveur Ollama local pour l'analyse de profil.

## Prérequis

1. **Ollama installé sur macOS**
   ```bash
   # Installer Ollama
   brew install ollama
   # ou télécharger depuis https://ollama.ai
   ```

2. **Démarrer le serveur Ollama**
   ```bash
   ollama serve
   ```
   Le serveur démarre par défaut sur `http://localhost:11434`

3. **Télécharger le modèle**
   ```bash
   ollama pull llama3.1
   ```

## Configuration du Backend

### Variables d'environnement

Ajoutez ces variables dans votre fichier `.env`:

```env
# AI Provider Configuration
AI_PROVIDER=local
AI_MODEL=llama3.1
AI_TIMEOUT=30000
```

### Configuration de l'URL

L'URL `AI_LOCAL_URL` doit pointer vers votre service Ollama. Vous avez deux options:

**Option 1: API Ollama native (Recommandé - Plus Simple)**

Utilisez directement l'API Ollama native qui est déjà prise en charge:

```env
AI_LOCAL_URL=http://localhost:11434/api/generate
```

✅ **Avantages**: 
- Pas besoin de service wrapper supplémentaire
- Configuration immédiate après avoir démarré Ollama
- Format natif supporté automatiquement

**Option 2: Service wrapper personnalisé (Avancé)**

Si vous avez créé un service wrapper qui expose un endpoint `/analyze`:

```env
AI_LOCAL_URL=http://localhost:7007/analyze
```

Ce service doit:
- Accepter une requête POST avec:
  ```json
  {
    "prompt": "votre prompt ici",
    "model": "llama3.1",
    "temperature": 0.7,
    "max_tokens": 8192
  }
  ```
- Retourner une réponse avec:
  ```json
  {
    "text": "réponse du modèle",
    "usage": {
      "prompt_tokens": 100,
      "completion_tokens": 200
    }
  }
  ```

## ✅ Support automatique de l'API Ollama native

Le service `ollama.service.ts` supporte maintenant automatiquement l'API Ollama native. 
Quand vous configurez `AI_LOCAL_URL=http://localhost:11434/api/generate`, le service:
- Détecte automatiquement que c'est l'API native
- Utilise le format de requête correct (`stream: false`)
- Parse correctement la réponse d'Ollama
- Extrait les métriques d'usage (`prompt_eval_count`, `eval_count`)

Aucune modification supplémentaire n'est nécessaire !

## Vérification

### 1. Vérifier que Ollama fonctionne

```bash
# Tester Ollama directement - Lister les modèles
curl http://localhost:11434/api/tags

# Tester l'API de génération (POST - Important!)
curl -X POST http://localhost:11434/api/generate \
  -H "Content-Type: application/json" \
  -d '{"model": "llama3.1", "prompt": "Hello", "stream": false}'

# Si vous obtenez une réponse JSON, Ollama fonctionne correctement
```

### 2. Tester le modèle

```bash
# Générer une réponse de test
ollama run llama3.1 "Bonjour, comment allez-vous?"
```

### 3. Vérifier la configuration backend

```bash
# Démarrer le backend
npm run start:dev

# Les logs doivent afficher:
# [OllamaService] Ollama service initialized with URL: http://localhost:11434/api/generate, Model: llama3.1
```

### 4. Configuration rapide (Exemple)

Configuration minimale dans `.env`:

```env
AI_PROVIDER=local
AI_LOCAL_URL=http://localhost:11434/api/generate
AI_MODEL=llama3.1
```

C'est tout ! Le service détectera automatiquement qu'il s'agit de l'API native et utilisera le bon format.

## Dépannage

### Erreur: "ECONNREFUSED"

**Problème**: Le serveur Ollama n'est pas accessible à l'URL configurée.

**Solutions**:
1. **Vérifier que Ollama est démarré**:
   ```bash
   ollama serve
   ```
   Le serveur doit démarrer et afficher un message indiquant qu'il écoute sur `http://localhost:11434`

2. **Vérifier l'URL dans `.env`**:
   - Pour l'API native: `AI_LOCAL_URL=http://localhost:11434/api/generate`
   - Pour un service wrapper: `AI_LOCAL_URL=http://localhost:7007/analyze`
   - ⚠️ **Attention**: Ne pas accéder à l'URL dans un navigateur (GET) - utiliser uniquement des requêtes POST

3. **Tester la connexion manuellement**:
   ```bash
   # Tester avec GET (pour la liste des modèles)
   curl http://localhost:11434/api/tags
   
   # Tester avec POST (pour la génération)
   curl -X POST http://localhost:11434/api/generate \
     -H "Content-Type: application/json" \
     -d '{"model": "llama3.1", "prompt": "test", "stream": false}'
   ```
   Doit retourner une réponse JSON valide

4. **Vérifier le port**: 
   - Par défaut Ollama utilise le port 11434
   - Si vous utilisez un service wrapper, vérifier qu'il est démarré sur le port 7007

### Erreur: "405 Method Not Allowed"

**Problème**: Vous essayez d'accéder à l'endpoint avec une mauvaise méthode HTTP.

**Solution**:
- L'endpoint `/api/generate` nécessite une requête **POST**, pas GET
- Ne pas ouvrir l'URL dans un navigateur (le navigateur fait un GET)
- Utiliser curl ou le backend NestJS qui envoie des requêtes POST automatiquement

### Erreur: "Model not found"

**Problème**: Le modèle `llama3.1` n'est pas téléchargé.

**Solution**:
```bash
ollama pull llama3.1
```

### Erreur: "Timeout"

**Problème**: Le modèle prend trop de temps à répondre.

**Solutions**:
1. Augmenter `AI_TIMEOUT` dans `.env` (par défaut 30000ms = 30s)
2. Utiliser un modèle plus rapide (ex: `llama3.1:8b` au lieu de `llama3.1`)
3. Réduire la taille du prompt

## Exemple de service wrapper simple

Si vous avez besoin d'un service wrapper, voici un exemple minimal:

```javascript
// wrapper-service.js
const express = require('express');
const { spawn } = require('child_process');
const app = express();

app.use(express.json());

app.post('/analyze', async (req, res) => {
  const { prompt, model, temperature, max_tokens } = req.body;
  
  // Appeler Ollama
  const response = await fetch('http://localhost:11434/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: model || 'llama3.1',
      prompt: prompt,
      stream: false,
      options: {
        temperature: temperature || 0.7,
        num_predict: max_tokens || 8192
      }
    })
  });
  
  const data = await response.json();
  
  res.json({
    text: data.response,
    usage: {
      prompt_tokens: data.prompt_eval_count,
      completion_tokens: data.eval_count
    }
  });
});

app.listen(7007, () => {
  console.log('Ollama wrapper service running on port 7007');
});
```

## Ressources

- [Documentation Ollama](https://github.com/ollama/ollama/blob/main/docs/api.md)
- [Modèles disponibles](https://ollama.ai/library)


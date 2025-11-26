# 🚀 Solution Rapide - Configuration Ollama

## ✅ Votre Ollama fonctionne déjà !

Vous avez confirmé que :
- ✅ Ollama est installé
- ✅ Le modèle `llama3.1` est téléchargé
- ✅ `ollama run llama3.1` fonctionne

## 🔧 Configuration immédiate

### 1. Mettre à jour votre fichier `.env`

Ajoutez/modifiez ces lignes dans `Backend/matchi-fy-backend/.env`:

```env
AI_PROVIDER=local
AI_LOCAL_URL=http://localhost:11434/api/generate
AI_MODEL=llama3.1
AI_TIMEOUT=60000
```

⚠️ **Important**: L'URL doit être exactement `http://localhost:11434/api/generate` (pas de faute de frappe)

### 2. Redémarrer le backend NestJS

```bash
cd Backend/matchi-fy-backend
npm run start:dev
```

### 3. Vérifier les logs

Vous devriez voir :
```
[OllamaService] Ollama service initialized with URL: http://localhost:11434/api/generate, Model: llama3.1
```

### 4. Tester l'analyse de profil

Dans l'app iOS, allez dans votre profil et cliquez sur "Analyser mon profil".

## ❓ Questions fréquentes

### Pourquoi l'erreur "405 Method Not Allowed" ?

C'est normal ! L'endpoint `/api/generate` nécessite une requête **POST**, pas GET. 
- ❌ Ne pas ouvrir l'URL dans un navigateur (le navigateur fait un GET)
- ✅ Le backend NestJS envoie automatiquement des requêtes POST

### Pourquoi "ERR_CONNECTION_REFUSED" sur le port 7007 ?

C'est normal ! Le port 7007 est pour un service wrapper optionnel que vous n'utilisez pas.
Avec l'API native, vous utilisez le port **11434** directement.

### Comment vérifier que tout fonctionne ?

Testez avec curl dans un terminal :

```bash
curl -X POST http://localhost:11434/api/generate \
  -H "Content-Type: application/json" \
  -d '{"model": "llama3.1", "prompt": "Bonjour", "stream": false}'
```

Si vous obtenez une réponse JSON avec `"response": "..."`, tout fonctionne ! 🎉

## 🐛 Dépannage

### Le backend ne se connecte pas à Ollama

1. **Vérifier qu'Ollama tourne** :
   ```bash
   # Dans un terminal, vérifier si Ollama écoute
   lsof -i :11434
   # ou simplement
   ollama list
   ```

2. **Démarrer Ollama si nécessaire** :
   ```bash
   ollama serve
   ```

3. **Vérifier l'URL dans `.env`** :
   Doit être exactement : `AI_LOCAL_URL=http://localhost:11434/api/generate`

### L'analyse prend trop de temps

Augmentez le timeout dans `.env` :
```env
AI_TIMEOUT=120000  # 2 minutes
```

### Erreur "Model not found"

Télécharger le modèle :
```bash
ollama pull llama3.1
```

## ✅ Configuration finale recommandée

```env
# Dans Backend/matchi-fy-backend/.env
AI_PROVIDER=local
AI_LOCAL_URL=http://localhost:11434/api/generate
AI_MODEL=llama3.1
AI_TIMEOUT=60000
```

C'est tout ! Redémarrez le backend et ça devrait fonctionner. 🚀


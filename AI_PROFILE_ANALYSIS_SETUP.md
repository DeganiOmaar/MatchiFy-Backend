# Configuration de l'Analyse de Profil par IA

Ce document explique comment configurer la fonctionnalité d'analyse de profil par IA utilisant l'API Gemini de Google.

## Prérequis

1. Un compte Google Cloud avec accès à l'API Gemini
2. Une clé API Gemini valide

## Configuration

### 1. Obtenir une clé API Gemini

1. Allez sur [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Créez une nouvelle clé API
3. Copiez la clé API générée

### 2. Variables d'environnement

Ajoutez les variables suivantes à votre fichier `.env` :

```env
# Gemini API Configuration
GEMINI_API_KEY=votre_cle_api_ici
GEMINI_MODEL=gemini-2.0-flash-exp
GEMINI_TEMPERATURE=0.7
GEMINI_MAX_TOKENS=8192
GEMINI_TIMEOUT=30000
```

### Variables disponibles

- `GEMINI_API_KEY` (requis) : Votre clé API Gemini
- `GEMINI_MODEL` (optionnel) : Modèle à utiliser (défaut: `gemini-2.0-flash-exp`)
  - Options recommandées : `gemini-2.0-flash-exp`, `gemini-1.5-pro`, `gemini-2.5-pro`
- `GEMINI_TEMPERATURE` (optionnel) : Température pour la génération (0.0-1.0, défaut: 0.7)
- `GEMINI_MAX_TOKENS` (optionnel) : Nombre maximum de tokens (défaut: 8192)
- `GEMINI_TIMEOUT` (optionnel) : Timeout en millisecondes (défaut: 30000)

### 3. Redémarrer le serveur

Après avoir ajouté les variables d'environnement, redémarrez le serveur backend :

```bash
npm run start:dev
```

## Utilisation

### Endpoint d'analyse

**POST** `/ai/profile-analysis`

- **Authentification** : Requis (JWT token, rôle: talent)
- **Body** : Vide (utilise le profil du talent authentifié)
- **Rate Limit** : 5 analyses par jour par utilisateur

### Endpoint de récupération

**GET** `/ai/profile-analysis`

- **Authentification** : Requis (JWT token, rôle: talent)
- **Description** : Récupère la dernière analyse sans en créer une nouvelle

## Réponse

La réponse contient :

```json
{
  "summary": "Résumé du profil en 3-4 lignes",
  "keyStrengths": ["Force 1", "Force 2", ...],
  "areasToImprove": ["Amélioration 1", "Amélioration 2", ...],
  "recommendedTags": ["Tag1", "Tag2", ...],
  "profileScore": 75,
  "analyzedAt": "2025-01-15T10:30:00.000Z"
}
```

## Gestion des erreurs

Le service gère automatiquement :

- **Timeouts** : Si la requête prend plus de 30 secondes
- **Quotas dépassés** : Si vous avez atteint votre limite d'API
- **Erreurs d'authentification** : Si la clé API est invalide
- **Erreurs de parsing** : Si la réponse JSON est invalide (retry automatique)

## Limitations

1. **Rate Limiting** : 5 analyses par jour par utilisateur (configurable dans `ai.controller.ts`)
2. **Taille du CV** : Les CVs sont tronqués à 3000 caractères pour l'analyse
3. **Format de CV** : Seuls les PDFs sont supportés pour l'extraction de texte (DOC/DOCX à venir)

## Dépannage

### Le service AI n'est pas disponible

- Vérifiez que `GEMINI_API_KEY` est défini dans votre `.env`
- Vérifiez que la clé API est valide
- Consultez les logs du serveur pour plus de détails

### Erreur de timeout

- Augmentez `GEMINI_TIMEOUT` dans votre `.env`
- Vérifiez votre connexion internet
- Le modèle peut être surchargé, réessayez plus tard

### Erreur de quota

- Vérifiez votre quota sur [Google Cloud Console](https://console.cloud.google.com/)
- Considérez passer à un modèle plus rapide (flash au lieu de pro)

## Coûts

Les modèles Gemini ont des coûts associés. Consultez [la page de tarification](https://ai.google.dev/pricing) pour plus d'informations.

Pour réduire les coûts :
- Utilisez `gemini-2.0-flash-exp` (plus rapide et moins cher)
- Limitez le nombre d'analyses par utilisateur
- Mettez en cache les analyses (déjà implémenté)





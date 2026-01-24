# Setup Azure OpenAI Embeddings (CLI)

Ce repo utilise Azure OpenAI pour générer des **embeddings** (vecteurs) utilisés par Elasticsearch pour le mode **Docs/RAG**.

## Variables requises

Le script [scripts/azure-openai-embeddings-setup.sh](scripts/azure-openai-embeddings-setup.sh) attend ces variables:

- `AZ_SUBSCRIPTION_ID`
- `AZ_LOCATION`
- `AZ_RESOURCE_GROUP`
- `AOAI_ACCOUNT_NAME`
- `AOAI_CUSTOM_DOMAIN`
- `AOAI_EMBEDDINGS_MODEL` (ex: `text-embedding-3-small`)
- `AOAI_EMBEDDINGS_DEPLOYMENT` (ex: `aoai-embeddings`)
- `SWA_NAME` (ex: `Axilum2030`)
- `SWA_RESOURCE_GROUP` (ex: `Axilum2030_group`)
- `ELASTICSEARCH_URL`
- auth ES: `ELASTICSEARCH_API_KEY` **ou** `ELASTICSEARCH_USERNAME`/`ELASTICSEARCH_PASSWORD`
- `ELASTICSEARCH_VECTOR_DIMS` (doit matcher la dimension du modèle embeddings)
- `AXILUM_AUTH_SECRET`

## Exemple d’exécution

```bash
az login

export AZ_SUBSCRIPTION_ID="..."
export AZ_LOCATION="westeurope"
export AZ_RESOURCE_GROUP="axilum2030-group"

export AOAI_ACCOUNT_NAME="axilum2030-aoai"
export AOAI_CUSTOM_DOMAIN="axilum2030-aoai"

export AOAI_EMBEDDINGS_MODEL="text-embedding-3-small"
export AOAI_EMBEDDINGS_DEPLOYMENT="aoai-embeddings"

export SWA_NAME="Axilum2030"
export SWA_RESOURCE_GROUP="Axilum2030_group"

export ELASTICSEARCH_URL="https://..."
export ELASTICSEARCH_API_KEY="..."
export ELASTICSEARCH_INDEX="axilum-user-docs"
export ELASTICSEARCH_VECTOR_DIMS="1536"

export AXILUM_AUTH_SECRET="..."

chmod +x scripts/azure-openai-embeddings-setup.sh
./scripts/azure-openai-embeddings-setup.sh
```

## Notes importantes

- Ne pas mettre `AzureWebJobsStorage` / `FUNCTIONS_WORKER_RUNTIME` dans Azure Static Web Apps.
- Si tu changes `ELASTICSEARCH_VECTOR_DIMS` après création de l’index, il faut recréer l’index (dense_vector dims immuables).

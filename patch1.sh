sed -i "s/const CLASSIFICATION_VERSION = '2'; \/\/ Atualizado para invalidar cache incorreto antigo//g" backend/src/integrations/confluence/confluenceOrchestrator.js
sed -i "s/cached.classification_version === CLASSIFICATION_VERSION//g" backend/src/integrations/confluence/confluenceOrchestrator.js
sed -i "s/classification_version: CLASSIFICATION_VERSION//g" backend/src/integrations/confluence/confluenceOrchestrator.js

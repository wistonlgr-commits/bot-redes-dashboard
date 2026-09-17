try { const { PromptTemplate } = require('langchain/prompts'); PromptTemplate.fromTemplate('{ "nombre": "" }'); } catch(e) { console.log('ERROR:', e.message); }

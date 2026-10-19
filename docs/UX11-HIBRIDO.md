# UX-11 — corrida + musculação

Execução autorizada em 19/10/2026, uma sprint por vez. Escolha do usuário: repetições e carga em cada série. Último item do ciclo UX-07 a UX-11: implementação e preview concluídos; publicação em produção bloqueada por créditos do Netlify. Não inicia biblioteca, equipes ou cobrança.

## Entrega

- Plano híbrido com sessões distintas de corrida e musculação, inclusive no mesmo dia. Reutilizados editor, prévia, calendário, registro, acompanhamento, evolução e exportação existentes.
- Treinador define exercícios, séries, repetições, carga e orientação em rascunho. Adicionar/remover exercício captura os demais campos. Revisão final mostra o bloco completo antes de confirmar destinatário e publicar.
- Atleta registra repetições e carga de cada série, em grupos expansíveis; primeiro exercício aberto. Resultados opcionais, sem preenchimento automático da prescrição. É possível acrescentar séries até o limite. Duração e sensações continuam opcionais, sem distância/pace na musculação estruturada.
- Relatos salvos aparecem no treino, evolução e consulta do treinador. Somente o atleta edita seus resultados. A equipe mantém comentários separados.
- Importação aceita `musculacao_json` opcional; modelo antigo continua válido e modelo híbrido é público. Exportação JSON existente inclui os novos campos carregados.
- Identidade visual, símbolo e logotipos oficiais, landing, credenciais e configuração de alertas preservados. Não há alteração comercial ou de acesso.

## Contrato

Prescrição: `strength: [{id,name,sets,reps,load_kg,notes}]`. Até 30 exercícios por sessão, IDs únicos de 1–80 caracteres (`A-Z`, `a-z`, dígitos, `_`, `-`), nome obrigatório até 200 caracteres, séries inteiras de 1–20, repetições opcionais inteiras de 1–1000, carga opcional de 0–1000 kg, orientação opcional até 1000 caracteres. Cargas aceitam até 3 casas decimais significativas.

Relato: `strength: [{exercise_id,sets:[{reps,load_kg}]}]`, até 30 exercícios sem IDs repetidos e 1–20 séries por exercício. Repetições inteiras de 0–1000 e carga de 0–1000 kg, ambas opcionais. Zero é diferente de vazio/null; carga é peso externo total, somando halteres. Vírgula e ponto são aceitos na interface. Exercícios inteiramente sem resultados são omitidos pelo cliente; séries internas vazias permanecem para preservar sua posição. Adicionar uma série vazia cria pendência no formulário, mas não inventa um resultado numérico.

Distância de uma sessão com prescrição estruturada e de seu relato deve ser vazia ou zero. Duração conta nos totais; musculação estruturada é excluída dos pares usados para pace. Não feito conserva valores, excluindo-os dos totais realizados. O texto antigo `gym` continua intacto e não é convertido ou classificado automaticamente.

Não há catálogo de exercícios, prescrição automática, diagnóstico, transformação dos planos antigos, fila offline ou gráficos de volume. Resultados sempre referenciam exercício, sessão, plano/versão e atleta exatos.

## Banco e conservação

Migração gerada pelo CLI: `supabase/migrations/20261019135644_atlas_run_hybrid_strength.sql`. Aplicada no projeto existente em 19/10/2026; o conector registrou a versão remota `20261019141417`, nome `atlas_run_hybrid_strength`. É a mesma migração, não executar novamente por diferença de timestamp.

Adicionadas colunas JSONB `strength NOT NULL DEFAULT '[]'` em sessões e atividades; nenhuma conversão ou UPDATE de dados antigos. Validação independente no banco, limites/chaves estritos e vínculo de exercício com a sessão e versão. Publicação transacional existente passa a incluir o bloco; mantém autoria, vínculo, revisão esperada e arquivamento. Funções novas privadas são INVOKER, com search_path vazio; não foram ampliados papéis, políticas ou grants sobre dados.

Proteção de compatibilidade recusa a omissão silenciosa de exercícios existentes no mesmo ID de sessão ao editar/revisar um rascunho; `[]` permite remoção explícita pelo editor atual em nova versão. Essa proteção não transforma clientes antigos em editores completos de musculação nem impede uma duplicação independente sem base de versão. Atualize/recarregue o app para trabalhar com o novo formato.

Antes e depois da migração, contagens e hashes de todas as colunas anteriores conferiram: 3 planos, 45 sessões, 10 atividades, 2 rascunhos, zero comentários, 5 perfis, 2 treinadores e 3 vínculos. Novas colunas foram excluídas apenas do cálculo de comparação; valores iniciais vazios foram conferidos. `updated_at` e demais valores anteriores preservados.

`tests/remote-strength.sql` passou sob os papéis reais em transação revertida: publicação híbrida, zero/null/decimal nas séries, recusa de exercício alheio à sessão, precisão excessiva e distância positiva na musculação, dono sem escrita do relato, recusa de omissão por cliente antigo, nova versão/arquivamento e conservação do relato anterior. Nenhum plano, relato, comentário ou evento de teste persistiu. A suíte local cobre também contas sem vínculo e vínculo revogado.

Advisor de segurança sem achado novo: mantém quatro informações sobre tabelas privadas de notificações com RLS e sem políticas para clientes e o aviso anterior de proteção de senha vazada, dependente do plano contratado. Nenhuma proteção foi desativada. Referência do aviso existente: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection .

## Validação

155/155 testes locais aprovados: contratos, CSV antigo/híbrido, formulário opcional por série, erro com foco no campo, falha/reenvio sem duplicação, conflito entre dispositivos, Não feito, reset entre sessões, pace da corrida separado da duração total, prescrição/remoção em novas versões, atualização PostgreSQL, imutabilidade e RLS. Build de 77 arquivos públicos, sem SQL, testes ou fixtures. Mudança posterior à suíte limitada ao tamanho de campos numéricos por CSS.

Navegador com dados fictícios em 320/390/768/1280 px: registrador e editor sem rolagem horizontal; campos de resultados em 16 px, cerca de 49 px de altura. Campos de prescrição com toque mínimo de 46 px, incluindo tablet. Zero e vazio distintos após salvar/reabrir; 12,125 kg preservado como 12.125. Resposta perdida após gravação mantém o formulário, e nova tentativa confirma o mesmo registro. Adicionar exercício mantém carga zero e demais prescrições; revisão final exibe os três exercícios. Treinador consulta séries em leitura e mantém somente o formulário de comentário.

Evidências locais ignoradas: `.artifacts/ux11-tests.tap`, `.artifacts/ux11-layouts.json`, `.artifacts/ux11-coach-layouts.json`, `.artifacts/ux11-musculacao-mobile.png`. A captura mostra dados fictícios. Testes no navegador não substituem teclado, instalação e uso autenticado em Android/iPhone físicos. O aceite físico dos alertas da UX-07 continua pendente.

## Publicação

Migração aplicada e validação remota concluída. [PR #5](https://github.com/jovemfelpitos/atlas-21k/pull/5) integrado à `main` após preview conferido. Implementação `a71a595cb5185d84af920b9cecebcfd02ffcf4a7`; merge `3912ea4c2ad767e7a667d44b55975f4a7f2336be`.

Preview `6ad62668806f9f16c668e84c`, estado `ready`, contexto `deploy-preview`, commit de implementação correto: https://deploy-preview-5--atlasrun.netlify.app . Novos módulos, módulos alterados, modelo híbrido, manuais, landing e rota `/app` responderam HTTP 200 e correspondem às fontes testadas; comparação normaliza finais de linha e retira somente o bloco de toolbar injetado pelo Netlify no HTML. `/entrar` respondeu HTTP 200; alertas desabilitados no preview.

**Produção bloqueada em 19/10/2026 às 11:18 BRT:** deploy `6ad626b48f8f2a7e6983f33b` do merge correto foi marcado `skipped`, estado `error`, motivo literal **Skipped due to account credit usage exceeded**. O painel confirmou que os créditos operacionais mantêm sites existentes no ar, mas não permitem novos deploys de produção neste ciclo. Nenhum upgrade, pagamento, mudança de plano ou tentativa de contornar o limite foi feito.

O site principal continua no deploy UX-10 `6ad60ea4fe2ce9457ce8327f`, commit `11392256b82e4e6f48d26cc6253fe9b6669f3924`. Runtime e páginas conferidos por HTTP 200, iguais à UX-10 após normalizar EOL e retirar somente o comentário de hospedagem e script público HUD injetados pelo Netlify. Configuração pública de alertas permanece habilitada com o mesmo hash de chave pública anterior à sprint. A migração já aplicada é compatível com esse frontend e não removeu dados/campos antigos.

Para concluir: liberar capacidade de deploy na conta Netlify (créditos disponíveis ou renovação do ciclo), reexecutar o build da `main` e verificar estado `ready`, commit, arquivos e configuração de alertas em produção. Não reaplicar a migração e não tratar o preview como produção. Aceite físico Android/iPhone continua pendente.

Evidências locais adicionais: `.artifacts/ux11-preservation.json`, `.artifacts/ux11-preview-checks.json` e `.artifacts/ux11-production-blocked.json`.

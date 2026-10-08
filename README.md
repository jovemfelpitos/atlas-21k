# Atlas Run

Repositório jovemfelpitos/atlas-21k. Produção: https://atlasrun.netlify.app/. O Netlify publica a branch main; `npm run build` gera dist com uma lista explícita de arquivos públicos, sem SQL, ferramentas ou testes. Execute `npm start` e abra http://127.0.0.1:4173. Para testes, `npm ci` e `npm test`: parser CSV, fluxos com respostas simuladas e RLS em PostgreSQL local (PGlite). Dependências são apenas de desenvolvimento. A demonstração oferece plano anterior e registros temporários em memória, perdidos ao atualizar. Nenhum treino usa localStorage como banco; apenas a sessão de autenticação é mantida no navegador.

## Supabase configurado

Projeto `atlasrun`, ref `acmzbjynzsutwdrbvxuw`, região `us-east-1`, organização jovemfelpitos's Org no plano Free. `schema-v2.sql` foi aplicado como migração `atlas_run_accounts_plans_and_activity_records`. As cinco tabelas têm RLS ativo e acesso SELECT anônimo revogado. As regras de admin verificam explicitamente o UUID autenticado. Não execute o schema novamente nesse projeto. `config.js` contém somente URL e chave publishable pública.

Auth: cadastro e e-mail/senha ativos, confirmação de e-mail mantida. Site URL `https://atlasrun.netlify.app`, redirecionamentos permitidos `https://atlasrun.netlify.app/**` e `http://127.0.0.1:4173/**`. O app valida os tokens recebidos após confirmação e os remove da URL. O SMTP padrão só envia para e-mails de membros da organização e limita mensagens; para outros usuários será necessário configurar SMTP próprio. Não foi desativada a confirmação de e-mail.

`node tools/check-api.js` confirmou Auth HTTP 200 e bloqueio de acesso anônimo aos planos (401). Os 12 testes locais incluem RLS em PostgreSQL, fluxos simulados e retorno da confirmação de e-mail. A conta de atleta está confirmada, há login real registrado no Auth e um registro de atividade persistido, vinculado corretamente ao atleta, ao plano e à sessão. Foram atribuídas as 39 sessões e o guia do plano histórico como referência, com datas preservadas e prova não confirmada. Nenhum resultado esportivo foi inserido pelo bootstrap. `plano-anterior-referencia.csv` permite importar essa mesma referência pela área admin quando a conta admin separada for criada.

O advisor não apontou problemas nas tabelas/RLS. Após o uso do Auth, apontou proteção contra senhas vazadas desativada; esse recurso exige plano Pro ou superior e não foi contratado: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection . Não foi feito upgrade. A suíte transacional `tests/remote-rls.sql` não pôde ser concluída pelo conector por erro `Invalid or expired requestState`; o isolamento foi testado no PostgreSQL local e as permissões/RLS foram inspecionadas no banco real. Antes de ampliar para outros usuários, confirme os testes entre contas reais e configure SMTP próprio.

## Configurar outro projeto (referência)

1. Confirme qual é o projeto correto; não reutilize projeto antigo por suposição. Execute `schema-v2.sql` uma vez no SQL Editor. É uma instalação aditiva: não remove atlas_records nem seus registros antigos. Estes não são migrados automaticamente, porque não têm identificação de plano/sessão confiável. O schema.sql antigo permanece como referência histórica.
2. Preencha config.js com URL do projeto e chave publishable ou anon pública. Nunca use secret/service_role. Habilite e-mail/senha e confirmação de e-mail. Configure URL de autenticação para o endereço local durante os testes.
3. Crie a conta do atleta, confirme e-mail, entre e salve nome/dias no Perfil. Crie uma conta com outro e-mail para administração, entre uma vez para criar o perfil e saia.
4. Somente no SQL Editor, conceda admin à segunda conta, usando seu UUID confirmado: `insert into public.atlas_admins(user_id) values ('UUID-DO-ADMIN');`. Crie o perfil antes de conceder esse acesso. Um trigger atualiza o sinalizador de exibição do perfil. A tabela de autorização não permite insert/update pelo frontend. O booleano do perfil não dá privilégios. Não promova a conta de atleta.
5. Entre como admin, selecione atleta, importe CSV, confira prévia completa e confirme. Entre como atleta para visualizar metas, sessões, evolução e guia. Preferências não remanejam datas. Vários planos são preservados.

## Validação externa obrigatória

Login real, confirmação de e-mail e persistência foram confirmados no projeto novo. O teste em dois dispositivos e a verificação entre duas contas reais de atletas e uma admin permanecem pendentes: A não deve ler/editar planos ou registros de B; atleta não deve importar nem se promover; admin não deve registrar atividades; uma importação inválida não deve criar plano parcial. A opção de sincronização atualiza sob demanda, sem Realtime. O teste local com falha de rede confirmou que o formulário permanece preenchido, sem fila offline. A publicação usa o mesmo projeto Supabase configurado nos testes locais.

Exportação JSON reúne todos os planos carregados, metas, guia e registros, excluindo usuário, senha e tokens. Envie manualmente ao GPT. Modelo e prompt: IMPORTACAO.md. Plano e guia antigos estão em legacy-plan.js e legacy-guide.js, rotulados como referência; prova de 15/11/2026 não confirmada.

Base técnica: https://supabase.com/docs/guides/database/postgres/row-level-security , https://supabase.com/docs/reference/javascript/auth-signinwithpassword e https://supabase.com/docs/guides/auth/auth-smtp . RLS e chaves compostas restringem propriedade e vínculo atleta/plano/sessão. Importação transacional usa SECURITY INVOKER. O backend novo foi criado com autorização; o projeto antigo não foi alterado. O frontend de produção usa somente a chave pública do projeto.

# Atlas 21K mobile

Aplicação estática sem etapa de build. Calendário e guia funcionam imediatamente. O registro sincronizado requer um projeto Supabase configurado. Nenhum dado de treino é salvo apenas no navegador. A sessão de login é mantida neste navegador; saia da conta em aparelhos compartilhados.

## Configurar uma vez

1. Crie um projeto em https://supabase.com/dashboard. No SQL Editor, execute o arquivo `schema.sql` uma única vez. Ele cria a tabela e as regras que restringem cada conta aos próprios registros.
2. Nas configurações do projeto, copie a URL do projeto e sua chave **publishable** (ou a chave pública **anon** legada). Preencha os dois valores em `config.js`. **Nunca coloque uma chave secret ou service_role neste arquivo.** A chave pública é feita para uso no navegador; as políticas SQL protegem os registros.
3. Publique a pasta no Netlify (instruções abaixo). No Supabase, em Authentication → URL Configuration, defina o Site URL como o endereço HTTPS do seu Netlify. Mantenha confirmação de e-mail ativa. A autenticação por e-mail/senha deve estar habilitada.
4. Abra o app, toque em Entrar → Criar conta, confirme o e-mail e volte para entrar. Use a mesma conta nos dois dispositivos.
5. Registre um treino no celular, abra no computador e confirme que aparece em Evolução. Edite a recuperação no computador e atualize no celular. Esse teste confirma a sincronização na sua conta.

## Publicar no Netlify

Extraia o ZIP. Arraste a pasta `atlas21-mobile` (com `index.html` na raiz) para https://app.netlify.com/drop ou para a área de deploy manual de um projeto existente. Não é necessário comando de build. Para atualizar, envie a pasta novamente ao mesmo projeto. Os registros permanecem no Supabase.

`schema.sql` e este guia não precisam ser publicados. Você pode removê-los da cópia enviada ao Netlify depois da configuração. Não remova `config.js`, `plan.js`, `app.js`, `style.css` ou `index.html`.

## Analisar no ChatGPT

Em Evolução, use **Baixar dados para análise** e envie o JSON nesta conversa. Ou use **Compartilhar resumo** e cole o texto. Nenhum envio automático ao ChatGPT ocorre. O JSON exportado exclui o identificador da conta e nunca inclui tokens ou senha. A exportação também serve de cópia dos seus registros.

## Limitações e verificação

O plano mantém as datas de 08/10 a 15/11/2026. Os longões são condicionais. Não há diagnóstico ou ajuste automático de prescrição. Alterações futuras no plano podem ser feitas no arquivo `plan.js` e republicadas.

O app necessita internet para login, leitura e gravação. Em falha de gravação, os campos permanecem abertos e o app informa que não salvou. Não há fila offline. Sem acesso ao seu projeto, não foi possível verificar autenticação e isolamento reais no serviço; valide o fluxo acima depois de configurar. A lógica foi verificada com respostas simuladas. O ambiente não dispõe de navegador executável para verificar visualmente a interface; a validação em um celular real permanece pendente.

Referências técnicas: https://supabase.com/docs/guides/auth/passwords ; https://supabase.com/docs/guides/database/postgres/row-level-security ; https://docs.netlify.com/deploy/create-deploys/

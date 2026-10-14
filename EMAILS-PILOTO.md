# Atlas Run — ativar os e-mails do piloto

Preparado em 14/10/2026. O frontend de cadastro, confirmação, reenvio e recuperação está implementado. O SMTP precisa ser configurado e a entrega real validada para concluir UX-02. Não desabilitar a confirmação de e-mail como alternativa.

## Opção para começar

Brevo Free: até 300 envios por dia, compartilhados entre tipos de e-mail. A integração usa uma chave SMTP dedicada; não usa a senha pessoal do Gmail nem uma API key no frontend. [Limites atuais](https://help.brevo.com/hc/en-us/articles/8292912279954-Add-or-remove-emails-from-your-plan), [SMTP do Brevo](https://help.brevo.com/hc/en-us/articles/7924908994450-Send-transactional-emails-using-Brevo-SMTP).

Para o piloto sem domínio comprado, é possível começar validando um remetente acessível ao dono. O Brevo informa que pode substituir o domínio de remetentes gratuitos/não autenticados por um endereço temporário `brevosend.com`. Isso será conferido no teste real; domínio próprio é a evolução para a marca. [Remetentes](https://help.brevo.com/hc/en-us/articles/208836149-Create-a-new-sender-From-name-and-From-email), [domínio temporário](https://help.brevo.com/hc/en-us/articles/16045394674066-Troubleshooting-Domain-authentication).

## Etapas que o dono faz diretamente

1. Crie sua conta Free no [Brevo](https://www.brevo.com/) e confirme o e-mail. Informe seus próprios dados reais no serviço. Senha e aceite de termos são concluídos por você.
2. Em **Settings → Senders, Domains, IPs → Senders**, cadastre um remetente com nome **Atlas Run** e um endereço que você recebe. Confirme pelo código recebido.
3. Confira se o envio **Transactional** está ativado. Se o Brevo exigir análise/ativação, conclua essa etapa antes de considerar o SMTP pronto.
4. Em **Settings → SMTP & API → SMTP**, gere uma chave SMTP chamada **Atlas Run piloto**, guarde-a e veja o **SMTP login**. A chave serve como senha; não envie a chave nem a senha de sua conta pelo chat.
5. Abra as configurações de SMTP do projeto Atlas Run no Supabase e configure diretamente:

| Campo | Valor |
|---|---|
| Sender name | Atlas Run |
| Sender email | Remetente que você validou no Brevo |
| Host | `smtp-relay.brevo.com` |
| Port | `587` |
| Username | O **SMTP login** exibido no Brevo; pode ser diferente do e-mail da conta |
| Password | A chave **SMTP** criada para o piloto |

Salve e ative SMTP próprio. Confira o limite de envio do Supabase; um limite de 30 e-mails/hora é suficiente para o piloto e continua sujeito aos 300/dia do provedor. Mantenha a confirmação de cadastro ativa. Não use o SMTP login técnico como Sender email. [Criar chave SMTP](https://help.brevo.com/hc/en-us/articles/7959631848850-Create-and-manage-your-SMTP-keys), [SMTP próprio no Supabase](https://supabase.com/docs/guides/auth/auth-smtp).

## Configuração do app

Site URL: `https://atlasrun.netlify.app`. Permitir os retornos de `/confirmar-email` e `/redefinir-senha`, inclusive a query `next` de confirmação. A configuração anterior já permite `https://atlasrun.netlify.app/**` e `http://127.0.0.1:4173/**`; os retornos novos estão dentro desses endereços. Antes de abrir uma operação maior, reduzir a lista aos destinos necessários. Nenhum destino externo é aceito como retorno ao app pelo frontend.

Definir mínimo de senha no Supabase como **8 caracteres**, alinhado ao cadastro e à redefinição. Login aceita a senha existente da conta. Os modelos revisados em `supabase/email-templates/` usam `{{ .ConfirmationURL }}`, preservando a validação e o redirecionamento do serviço. Copiar os modelos para as seções correspondentes do Supabase; eles não são enviados no build público. Usar os assuntos **Confirme seu e-mail — Atlas Run** e **Redefina sua senha — Atlas Run**. Evitar rastreamento de cliques em links de autenticação.

## Aceite de entrega real

Após SMTP ativo, confirmar cadastro e recuperar senha por meio de uma caixa de e-mail fora da equipe do Supabase. Conferir recebimento, remetente, link de retorno e caixa de spam. A criação e alteração de senha são feitas diretamente pelo usuário, sem compartilhá-la. Testar link usado/expirado e reenvio; conferir que a conta de treinador chega à sua área sem acesso a terceiros e que as contas existentes preservam a última área e o histórico.

O envio aceito pela API não prova chegada na caixa de entrada. Registrar os resultados do provedor e a verificação pelo destinatário. Até esse teste ser concluído, a sprint fica com **configuração/validação de e-mails pendente**, ainda que as telas já estejam publicadas.

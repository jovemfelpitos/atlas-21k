# Atlas Run — ativar os e-mails do piloto

Concluído em 14/10/2026. Cadastro, confirmação, reenvio e recuperação implementados, com SMTP próprio ativo. O Brevo confirmou envio/entrega/clique dos e-mails de confirmação e recuperação; o dono confirmou que os dois links funcionaram e entrou na área de treinador com uma nova conta de teste. Confirmação de e-mail mantida.

Resultado em 14/10/2026: remetente verificado no Brevo; chave SMTP criada e inserida diretamente pelo dono no Supabase. SMTP ativo com `smtp-relay.brevo.com:587`, nome Atlas Run, intervalo de 60 segundos por usuário e senha mínima de 8 caracteres. Modelos de confirmação e recuperação aplicados e conferidos após reabrir o painel. O pedido de recuperação no site publicado retornou sucesso e ficou registrado no Auth; o Brevo confirmou Enviado/Entregue/Clicado para recuperação e novo cadastro. O remetente foi reescrito para o domínio técnico `brevosend.com`, como previsto para o piloto sem domínio próprio. Nenhuma senha de usuário foi alterada pelo agente. O dono confirmou os dois links e a entrada como treinador. Leitura remota da nova conta: e-mail confirmado, onboarding concluído, preferência treinador, áreas atleta/treinador, sem admin ou vínculos; RLS permitiu somente seu próprio perfil e nenhum plano/relato alheio. O banco passou de quatro para cinco contas/perfis e de um para dois treinadores ativos; manteve um plano, 39 sessões e uma atividade.

## Opção para começar

Brevo Free: até 300 envios por dia, compartilhados entre tipos de e-mail. A integração usa uma chave SMTP dedicada; não usa a senha pessoal do Gmail nem uma API key no frontend. [Limites atuais](https://help.brevo.com/hc/en-us/articles/8292912279954-Add-or-remove-emails-from-your-plan), [SMTP do Brevo](https://help.brevo.com/hc/en-us/articles/7924908994450-Send-transactional-emails-using-Brevo-SMTP).

Para o piloto sem domínio comprado, o remetente acessível ao dono foi validado. O Brevo substituiu o domínio do remetente gratuito por um endereço técnico `brevosend.com`, confirmado no log de entrega real. Domínio próprio é a evolução para a marca. [Remetentes](https://help.brevo.com/hc/en-us/articles/208836149-Create-a-new-sender-From-name-and-From-email), [domínio temporário](https://help.brevo.com/hc/en-us/articles/16045394674066-Troubleshooting-Domain-authentication).

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

Mínimo de senha no Supabase salvo como **8 caracteres**, alinhado ao cadastro e à redefinição. Login aceita a senha existente da conta. Os modelos revisados em `supabase/email-templates/` foram aplicados após a ativação do SMTP; usam `{{ .ConfirmationURL }}`, preservando a validação e o redirecionamento do serviço. Eles não são enviados no build público. Assuntos salvos: **Confirme seu e-mail — Atlas Run** e **Redefina sua senha — Atlas Run**. O painel atual de rastreamento transacional do Brevo oferece anonimização de aberturas/cliques; não foi encontrada uma opção de desligamento nessa tela e ela não foi alterada. O retorno dos links foi validado pelo dono no teste real.

## Aceite de entrega real

Após SMTP ativo, confirmar cadastro e recuperar senha por meio de uma caixa de e-mail fora da equipe do Supabase. Conferir recebimento, remetente, link de retorno e caixa de spam. A criação e alteração de senha são feitas diretamente pelo usuário, sem compartilhá-la. Testar link usado/expirado e reenvio; conferir que a conta de treinador chega à sua área sem acesso a terceiros e que as contas existentes preservam a última área e o histórico.

O envio aceito pela API e o evento Entregue do provedor não substituem a conferência da caixa de entrada e do link pelo destinatário. Neste piloto, a confirmação do dono complementou esses registros e encerrou o aceite de e-mails da UX-02. A troca efetiva de senha foi coberta por teste local; o agente não alterou credenciais reais. A matriz completa entre contas/dispositivos e alteração de e-mail permanece em UX-06, após a implementação do perfil em UX-03.

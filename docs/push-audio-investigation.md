# Diagnóstico do áudio de vendas

## Causa encontrada

O push não tinha um protocolo de confirmação. `public/sw.js` enviava `PLAY_SALE_SOUND` para todas as janelas, marcava a notificação como `silent: true` sempre e, em seguida, a página iniciava `soundPlayer.play()` e um segundo `HTMLAudioElement` em paralelo. O player também podia aguardar indefinidamente `AudioContext.resume()` depois que o push chegava; esse callback não é um gesto do usuário no iOS. Assim, uma falha de autoplay era silenciosa e o som padrão do sistema também já havia sido removido.

## Histórico revisado

| Commit | Comportamento relevante |
| --- | --- |
| `bb1ab2d` | Worker entregava a mensagem e mostrava a notificação; não havia confirmação de áudio. |
| `44e2368` | Mensagem e notificação eram concorrentes; a página podia iniciar Web Audio e HTML Audio juntos. |
| `913e834` | Worker podia interromper a notificação esperando a página; introduziu guarda de desbloqueio/visibilidade. |
| `d75665b` | Tentou ACK da página e suprimia a notificação após ACK; isso violava a exigência de alerta visual para cada push. |
| `fb5557e` | Ajustou a origem do ACK e manteve dois caminhos de áudio. |
| `f5ac782` | Removeu o ACK e voltou ao broadcast concorrente. |
| `93353e8` / `bee1e8d` | `silent: true` incondicional, removendo o fallback sonoro do sistema mesmo quando o áudio local falhava. |
| `41f73e2` | Removeu o `unlockAudio()` do callback, mas ainda dependia de `play()` sem confirmação. |
| `2f79ef4` | Removeu a trava `unlocked`, mas `resume()` ainda podia ficar pendente e o fallback continuava concorrente. |

## Protocolo atual

Cada push recebe um `id`. O worker escolhe uma única janela `/painel` visível, envia um `MessagePort` e aguarda uma resposta limitada por prazo. A página registra `push recebido → mensagem recebida → áudio iniciado/bloqueado`; o worker só usa `silent: true` quando recebe `status: started`. Em qualquer outro caso a notificação visual permanece e `silent: false` deixa o sistema decidir o som. Clique na notificação apenas navega; não toca uma segunda vez.

O registro usa `/sw.js?v=push-audio-20260909-1`, `updateViaCache: "none"`, `registration.update()` e cabeçalho `no-store`. Isso faz o PWA buscar o worker novo sem apagar a inscrição Push nem exigir `unregister()`.

O player usa Web Audio somente quando o contexto já está `running` e, se esse caminho não confirmar início, tenta HTML Audio sequencialmente. `unlockAudio()` é chamado apenas em interação real. Não existe áudio local no botão de disparo do push.

## Limite da plataforma

O WebKit documenta que a notificação precisa ser exibida para cada push e que reprodução de mídia iniciada por código precisa de uma interação válida do usuário. Ele não oferece um campo de som customizado para `showNotification()`. Portanto, não é possível prometer o toque de `cash-machine.mp3` quando o PWA está suspenso ou quando o iOS bloqueia autoplay; nessa situação o sistema usa o som padrão (quando `silent` não foi solicitado). O teste manual continua sendo a forma de desbloquear/confirmar o áudio customizado.

Referências oficiais: [Web Push no WebKit](https://webkit.org/blog/12945/meet-web-push/), [políticas de mídia do iOS](https://webkit.org/blog/6784/new-video-policies-for-ios/) e [opções da Notification API](https://notifications.spec.whatwg.org/#dictdef-notificationoptions).

Para diagnóstico temporário em um aparelho, defina `localStorage.trackbase:push-debug = "1"` e recarregue o PWA. Os logs são emitidos somente com essa flag (ou quando o worker é aberto com `?debug=1`).

# WA Media Downloader (Cross-Language Microservice)

Serviço utilitário multiplataforma para download, processamento e entrega de mídia via protocolo do WhatsApp.

O sistema foi arquitetado utilizando uma abordagem de microserviço multi-linguagem:
* **Controller/Network (Node.js):** Utiliza a biblioteca `baileys` (WebSockets) para escutar eventos de chat em tempo real, gerenciar sessões VIP e orquestrar processos assíncronos.
* **Worker de Extração (Python):** O Node.js invoca rotinas em Python via `child_process.spawn` para executar a extração de dados brutos de plataformas de vídeo (`yt-dlp`), isolando o gargalo de processamento.
* **File System Management:** Implementação de lógica de verificação de *buffers* e tamanho de arquivos (`fs.statSync`) para decidir dinamicamente o *mimetype* do payload de entrega (Vídeo nativo vs. Documento anexado).

const { 
    default: makeWASocket, 
    useMultiFileAuthState, 
    DisconnectReason, 
    fetchLatestBaileysVersion 
} = require('@whiskeysockets/baileys');
const pino = require('pino');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

// 📋 LISTA VIP - RECOMENDADO: Usar variáveis de ambiente (process.env.VIP_NUMBERS)
const NUMEROS_PERMITIDOS = [
    '5531900000000', // Substitua pelos seus números localmente
];

const PREFIXO = '!';

async function connectToWhatsApp() {
    const { version } = await fetchLatestBaileysVersion();
    // A pasta 'auth_info' deve estar no seu .gitignore
    const { state, saveCreds } = await useMultiFileAuthState('auth_info');

    const sock = makeWASocket({
        version,
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false,
        auth: state,
        browser: ["Bot System", "MacOS", "1.0.0"], 
        connectTimeoutMs: 60000,
        keepAliveIntervalMs: 10000,
        emitOwnEvents: true, 
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            console.log('\nEscaneie o QR Code:');
            qrcode.generate(qr, { small: true });
        }

        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect.error)?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) connectToWhatsApp();
        } else if (connection === 'open') {
            console.log('✅ Bot Online.');
        }
    });

    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        try {
            if (type !== 'notify') return;

            for (const msg of messages) {
                if (!msg.key.remoteJid) continue;
                
                const isGroup = msg.key.remoteJid.endsWith('@g.us');
                let senderRaw = msg.key.fromMe ? sock.user.id : (isGroup ? (msg.key.participant || "") : msg.key.remoteJid);
                const senderLimpo = senderRaw.split(':')[0].split('@')[0].replace(/\D/g, '');

                const texto = msg.message?.conversation || 
                              msg.message?.extendedTextMessage?.text || 
                              msg.message?.imageMessage?.caption || '';
                
                if (!texto) continue;

                const ehVip = NUMEROS_PERMITIDOS.includes(senderLimpo);

                if (ehVip && texto.startsWith(PREFIXO)) {
                    const url = texto.replace(PREFIXO, '').trim();
                    if (!url) return;

                    await sock.sendMessage(msg.key.remoteJid, { text: '⏳ Processando download...' }, { quoted: msg });

                    const pythonProcess = spawn('python3', ['downloader.py', url]);
                    let downloadSucesso = false;

                    pythonProcess.stdout.on('data', async (data) => {
                        const arquivo = data.toString().trim();
                        if (fs.existsSync(arquivo)) {
                            downloadSucesso = true;
                            const stats = fs.statSync(arquivo);
                            const mb = stats.size / (1024 * 1024);

                            try {
                                const payload = mb > 80 
                                    ? { document: { url: arquivo }, mimetype: 'video/mp4', fileName: path.basename(arquivo) }
                                    : { video: { url: arquivo }, caption: '🎥 Vídeo baixado', mimetype: 'video/mp4' };

                                await sock.sendMessage(msg.key.remoteJid, payload, { quoted: msg });
                            } catch (err) {
                                console.error(`Erro envio:`, err);
                            }
                            if (fs.existsSync(arquivo)) fs.unlinkSync(arquivo);
                        }
                    });

                    pythonProcess.on('close', async (code) => {
                         if (code !== 0 && !downloadSucesso) {
                            await sock.sendMessage(msg.key.remoteJid, { text: '❌ Erro ao processar vídeo.' }, { quoted: msg });
                         }
                    });
                }
            }
        } catch (erro) {
            console.error('Erro no loop de mensagens:', erro);
        }
    });
}

connectToWhatsApp();

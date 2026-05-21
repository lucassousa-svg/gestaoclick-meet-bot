const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const puppeteer = require('puppeteer');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(express.static(__dirname));

let browser;
let page;

wss.on('connection', (ws) => {
    console.log('Cliente conectado ao WebSocket');

    ws.on('message', async (message) => {
        const data = JSON.parse(message);
        console.log('Comando recebido:', data);

        if (data.action === 'start') {
            try {
                if (!browser) {
                    ws.send(JSON.stringify({ status: 'Iniciando navegador em modo econômico...' }));
                    
                    browser = await puppeteer.launch({
                        headless: "new",
                        args: [
                            '--no-sandbox',
                            '--disable-setuid-sandbox',
                            '--disable-dev-shm-usage', 
                            '--use-fake-ui-for-media-stream',
                            '--disable-audio-output',
                            '--disable-gpu',                 // Desativa processamento gráfico pesado
                            '--disable-software-rasterizer',  // Economiza CPU e RAM na nuvem
                            '--single-process',               // Força o Chrome a usar apenas UM processo (salva muita RAM)
                            '--no-zygote'                     // Desativa processos base inúteis para o bot
                        ]
                    });
                    page = await browser.newPage();
                    
                    // Bloqueia o carregamento de imagens para economizar ainda mais memória
                    await page.setRequestInterception(true);
                    page.on('request', (req) => {
                        if (req.resourceType() === 'image') {
                            req.abort();
                        } else {
                            req.continue();
                        }
                    });
                }

                ws.send(JSON.stringify({ status: `Entrando na reunião: ${data.url}` }));
                await page.goto(data.url, { waitUntil: 'component' }); // Carrega apenas o essencial, sem esperar scripts pesados de terceiros

                setTimeout(async () => {
                    try {
                        const buttons = await page.$$('button');
                        for (let button of buttons) {
                            let text = await page.evaluate(el => el.textContent, button);
                            if (text.includes('Pedir para participar') || text.includes('Ask to join')) {
                                await button.click();
                                ws.send(JSON.stringify({ status: 'Botão "Pedir para participar" clicado!' }));
                                break;
                            }
                        }
                    } catch (err) {
                        console.log('Botão não encontrado');
                    }
                }, 7000); // 7 segundos de segurança para o plano free responder

            } catch (error) {
                ws.send(JSON.stringify({ status: `Erro: ${error.message}` }));
            }
        }

        if (data.action === 'stop') {
            if (browser) {
                await browser.close();
                browser = null;
                page = null;
                ws.send(JSON.stringify({ status: 'Robô desconectado e parado.' }));
            }
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});

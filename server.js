const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const puppeteer = require('puppeteer-core');
const chromium = require('@sparticuz/chromium');

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
                    ws.send(JSON.stringify({ status: 'Iniciando navegador em nuvem...' }));
                    
                    browser = await puppeteer.launch({
                        args: chromium.args,
                        defaultViewport: chromium.defaultViewport,
                        executablePath: await chromium.executablePath(),
                        headless: chromium.headless,
                        ignoreHTTPSErrors: true,
                    });
                    page = await browser.newPage();
                }

                ws.send(JSON.stringify({ status: `Entrando na reunião: ${data.url}` }));
                await page.goto(data.url, { waitUntil: 'networkidle2' });

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
                }, 5000);

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

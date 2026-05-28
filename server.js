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
                    ws.send(JSON.stringify({ status: 'Iniciando navegador camuflado...' }));
                    
                    browser = await puppeteer.launch({
                        headless: "new",
                        args: [
                            '--no-sandbox',
                            '--disable-setuid-sandbox',
                            '--disable-dev-shm-usage', 
                            '--use-fake-ui-for-media-stream',
                            '--disable-audio-output',
                            '--disable-gpu',                 
                            '--disable-software-rasterizer',  
                            '--single-process',               
                            '--no-zygote',
                            // CAMUFLAGEM ANTIBOT:
                            '--disable-blink-features=AutomationControlled', // Esconde o fato de ser um robô (remove o navigator.webdriver)
                            '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' // Finge ser Windows
                        ]
                    });
                    page = await browser.newPage();
                    
                    // Remove vestígios extras de automação via script injetado
                    await page.evaluateOnNewDocument(() => {
                        Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
                    });

                    // Bloqueia imagens para economizar memória RAM
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
                await page.goto(data.url, { waitUntil: 'domcontentloaded' }); 

                // Aguarda 10 segundos para a página estabilizar
                setTimeout(async () => {
                    try {
                        ws.send(JSON.stringify({ status: 'Preenchendo nome do robô...' }));
                        
                        const nameFilled = await page.evaluate(() => {
                            const input = document.querySelector('input[type="text"]');
                            if (input) {
                                input.value = 'Robo GestaoClick';
                                input.dispatchEvent(new Event('input', { bubbles: true }));
                                input.dispatchEvent(new Event('change', { bubbles: true }));
                                return true;
                            }
                            return false;
                        });

                        if (nameFilled) {
                            ws.send(JSON.stringify({ status: 'Nome preenchido! Validando...' }));
                            await new Promise(r => setTimeout(r, 2000)); 
                        }

                        ws.send(JSON.stringify({ status: 'Pressionando botão de participar...' }));
                        
                        const clicked = await page.evaluate(() => {
                            const buttons = Array.from(document.querySelectorAll('button'));
                            const target = buttons.find(b => {
                                const text = b.textContent || '';
                                return text.includes('Pedir para participar') || text.includes('Ask to join') || text.includes('Participar');
                            });
                            if (target) {
                                target.click();
                                return true;
                            }
                            return false;
                        });

                        if (clicked) {
                            ws.send(JSON.stringify({ status: 'Sucesso: Pedido de entrada enviado ao Meet!' }));
                        } else {
                            ws.send(JSON.stringify({ status: 'Aviso: Botão não encontrado.' }));
                        }

                    } catch (err) {
                        ws.send(JSON.stringify({ status: `Erro na automação: ${err.message}` }));
                    }
                }, 10000); 

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

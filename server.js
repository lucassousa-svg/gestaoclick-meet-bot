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
                            '--disable-gpu',                 
                            '--disable-software-rasterizer',  
                            '--single-process',               
                            '--no-zygote'                     
                        ]
                    });
                    page = await browser.newPage();
                    
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

                // Aguarda 10 segundos para a página do Meet carregar os elementos na máquina gratuita
                setTimeout(async () => {
                    try {
                        ws.send(JSON.stringify({ status: 'Preenchendo nome do robô...' }));
                        
                        // Localiza o campo de texto de nome e digita "Robô GestãoClick"
                        const inputField = await page.$('input[type="text"]');
                        if (inputField) {
                            await inputField.click();
                            await page.keyboard.type('Robo GestaoClick');
                            // Pequena pausa de 1 segundo para o Meet validar o nome digitado
                            await new Promise(r => setTimeout(r, 1000)); 
                        }

                        ws.send(JSON.stringify({ status: 'Procurando botão de participar...' }));
                        const buttons = await page.$$('button');
                        let clicou = false;

                        for (let button of buttons) {
                            let text = await page.evaluate(el => el.textContent, button);
                            if (text.includes('Pedir para participar') || text.includes('Ask to join') || text.includes('Participar')) {
                                await button.click();
                                ws.send(JSON.stringify({ status: 'Sucesso: Botão "Pedir para participar" clicado!' }));
                                clicou = true;
                                break;
                            }
                        }

                        if (!clicou) {
                            ws.send(JSON.stringify({ status: 'Aviso: Botão não encontrado. Verifique se a reunião está aberta.' }));
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

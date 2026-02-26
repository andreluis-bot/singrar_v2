# SeaTrack Pro - Sistema de Navegação Marítima e Diário de Bordo

## Visão Geral
O **SeaTrack Pro** é um aplicativo de navegação marítima focado em pescadores e navegadores que buscam uma interface limpa, fluida e altamente técnica. Ele foi projetado com uma estética de "painel de instrumentos" (Technical Dashboard), utilizando cores escuras, fontes monoespaçadas para dados precisos e interações elegantes.

O projeto foi construído utilizando **React**, **Zustand** (gerenciamento de estado), **Leaflet** (mapas), **Recharts** (gráficos) e **Motion** (animações fluidas).

## Funcionalidades Principais
1. **Mapa de Navegação (Chartplotter):**
   - Rastreamento em tempo real com GPS.
   - Modos de mapa: Náutico, Satélite e Ruas.
   - Rotação do mapa (Norte Acima vs. Curso Acima).
   - Radar meteorológico integrado (Vento e Chuva via Windy).
   - Alarme de Âncora (com raio configurável).
   - Gravação de rotas (Corrico) e marcação de Waypoints.
   - Sensor de colisão (acelerômetro) e botão de Emergência (SOS).

2. **Meteorologia e Condições Marítimas:**
   - Previsão do tempo atual e para 7 dias.
   - Dados marítimos: Altura e período das ondas.
   - Alerta de queda brusca de pressão atmosférica (indicativo de mau tempo).
   - Seleção de local no mapa para verificar a previsão em outras áreas.

3. **Previsões (Tábuas de Maré e Sol/Lua):**
   - Gráficos de maré.
   - Previsão de atividade de peixes (teoria solunar).
   - Fases da lua e horários de nascer/pôr do sol.

4. **Diário de Bordo (Logbook):**
   - Registro de capturas de peixes (com foto, peso, tamanho e espécie).
   - Histórico de waypoints (incluindo notas de voz e fotos).
   - Histórico de rotas gravadas.

## Arquitetura e Preparação para Capacitor + Ionic
Este projeto foi estruturado pensando na futura compilação como um aplicativo nativo utilizando **Capacitor** e **Ionic**.

### Integração de Sensores (Capacitor)
Para explorar todo o potencial do hardware do dispositivo móvel, as seguintes APIs do Capacitor devem ser integradas:
- `@capacitor/geolocation`: Para rastreamento GPS preciso em segundo plano (Background Geolocation).
- `@capacitor/camera`: Para tirar fotos das capturas diretamente pelo app.
- `@capacitor/filesystem`: Para salvar fotos e áudios localmente.
- `@capacitor/haptics`: Para fornecer **feedback tátil** (vibração) ao clicar em botões, lançar a âncora ou disparar alarmes.
- `@capacitor/motion`: Para aprimorar o sensor de colisão atual (que usa a API web `DeviceMotionEvent`).
- `@capacitor/device`: Para obter informações sobre a bateria e evitar que o app hiberne durante a navegação.

### Feedback Tátil e Micro-interações
O design atual já prevê interações fluidas. Com a adição do Capacitor Haptics, podemos adicionar:
- `Haptics.impact({ style: ImpactStyle.Light })` ao alternar abas.
- `Haptics.impact({ style: ImpactStyle.Heavy })` ao ativar o alarme de âncora ou salvar um waypoint.
- `Haptics.vibrate()` contínuo durante o alerta de colisão ou emergência.

## Preparação para o Website de Rastreamento em Tempo Real
O sistema foi concebido para permitir que familiares ou autoridades acompanhem a embarcação em tempo real através de um website.

### Arquitetura de Sincronização (Backend)
Para implementar o rastreamento em tempo real, o projeto deve ser integrado a um backend (ex: **Firebase Realtime Database**, **Supabase**, ou um servidor Node.js com **Socket.io**).

1. **Transmissão de Dados (App -> Servidor):**
   - O Zustand store (`src/store.ts`) deve ser modificado para enviar a `location` atual, `emergency` status e `collisionCountdown` para o servidor via WebSocket a cada 5-10 segundos.
   - O envio deve continuar em background (usando plugins de background do Capacitor).

2. **Recepção de Dados (Servidor -> Website):**
   - O website consumirá esses dados e exibirá um mapa (Leaflet) com a posição atualizada do barco.
   - Se o status `emergency` for `true`, o website emitirá um alerta sonoro e visual em vermelho.

3. **Integração Sugerida:**
   - **Supabase:** Ideal para armazenar o diário de bordo na nuvem e usar o *Realtime* para transmitir a localização.
   - **Firebase:** Excelente para Push Notifications (avisar a família se o barco sair de uma área segura).

## Estrutura de Código e Estilização
- **Estilo "Feito à Mão":** Utilizamos Tailwind CSS com uma paleta de cores baseada em tons de azul escuro (`#0a192f`, `#112240`, `#233554`) e acentos em cyan/verde (`#64ffda`), inspirada em interfaces de radar e sonares.
- **Transições Suaves:** O uso de `transition-all`, `duration-300`, e `ease-in-out` garante que menus, modais e botões respondam de forma orgânica.
- **Animações (Motion):** A biblioteca `motion` (Framer Motion) é recomendada para animar a troca de abas (`<main>`) e a entrada de modais, garantindo que a interface não pareça "dura".

## Próximos Passos para Produção
1. Instalar o Capacitor (`npm install @capacitor/core @capacitor/cli`).
2. Inicializar o Capacitor (`npx cap init`).
3. Adicionar as plataformas (`npx cap add android`, `npx cap add ios`).
4. Substituir as APIs Web (ex: `navigator.geolocation`, `DeviceMotionEvent`) pelos plugins oficiais do Capacitor para garantir funcionamento em background.
5. Configurar o backend (Supabase/Firebase) para sincronização do Diário de Bordo e Rastreamento Web.

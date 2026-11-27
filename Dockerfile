FROM node:22-alpine
WORKDIR /app
COPY package.json server.js agent-core.js voice-intake.js ./
COPY index.html privacy.html terms.html thank-you.html computer-help.html office-moving.html office-it-support.html workstation-setup.html office-wifi.html remote-it-support.html emergency-tech-repair.html airbnb-tech-setup.html home-office-setup.html ai-receptionist-setup.html wifi-mesh.html ai-at-home.html smart-home.html furniture-assembly.html styles.css script.js chat-widget.css chat-widget.js robots.txt sitemap.xml tracking.config.js tracking.loader.js ./
COPY images ./images
RUN mkdir -p /app/data && chown node:node /app/data
ENV NODE_ENV=production PORT=3000
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/ready').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
USER node
CMD ["node", "server.js"]

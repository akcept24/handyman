FROM node:22-alpine
WORKDIR /app
COPY package.json server.js ./
COPY index.html privacy.html terms.html styles.css script.js robots.txt sitemap.xml ./
COPY images ./images
ENV NODE_ENV=production PORT=3000
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
USER node
CMD ["node", "server.js"]

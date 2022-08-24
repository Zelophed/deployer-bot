FROM node:17-alpine

RUN addgroup -g 1003 deployer \
    && adduser -u 1001 -g 1003 -s /bin/sh -D zelophed

USER zelophed

ENTRYPOINT ["node","--es-module-specifier-resolution=node","compiled/index.js"]
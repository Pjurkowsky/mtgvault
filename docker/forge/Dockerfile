# syntax=docker/dockerfile:1
# MTG Vault's Forge service (specs 024, 029): an official Forge release, MTG Vault's game runner
# compiled against it, and a small HTTP API. Forge is GPL-3: https://github.com/Card-Forge/forge
#   docker build -t mtgvault-forge docker/forge
# FORGE_KEY, when set, is a password every request must send as X-Forge-Key (spec 029).

ARG FORGE_VERSION=2.0.16

FROM eclipse-temurin:17-jdk AS build
ARG FORGE_VERSION
RUN apt-get update && apt-get install -y --no-install-recommends bzip2 curl ca-certificates && rm -rf /var/lib/apt/lists/*
RUN mkdir /forge \
 && curl -fsSL "https://github.com/Card-Forge/forge/releases/download/forge-${FORGE_VERSION}/forge-installer-${FORGE_VERSION}.tar.bz2" \
  | tar -xj -C /forge \
 && cd /forge \
 && rm -rf docs res/adventure res/music res/sound res/skins res/tutorial res/conquest res/puzzle \
      adventure-editor* forge-adventure* forge-gui-mobile-dev-*.jar gdx-particle-editor.jar *.exe *.cmd *.command
COPY MtgvaultSim.java /src/
RUN mkdir /opt/mtgvault && javac -cp "/forge/forge-gui-desktop-${FORGE_VERSION}-jar-with-dependencies.jar" -d /opt/mtgvault /src/MtgvaultSim.java

FROM eclipse-temurin:17-jre
ARG FORGE_VERSION
RUN apt-get update && apt-get install -y --no-install-recommends python3 && rm -rf /var/lib/apt/lists/*
COPY --from=build /forge /forge
COPY --from=build /opt/mtgvault /opt/mtgvault
COPY server.py /opt/mtgvault/server.py
ENV FORGE_HOME=/forge FORGE_VERSION=${FORGE_VERSION} FORGE_MEMORY=2g
LABEL org.opencontainers.image.source="https://github.com/pjurkowsky/mtgvault" \
      org.opencontainers.image.description="Forge ${FORGE_VERSION} for MTG Vault pod simulation" \
      org.opencontainers.image.licenses="GPL-3.0-only"
EXPOSE 8790
HEALTHCHECK --interval=30s --timeout=5s CMD python3 -c "import os, urllib.request; urllib.request.urlopen(urllib.request.Request('http://127.0.0.1:8790/health', headers={'X-Forge-Key': os.environ.get('FORGE_KEY', '')}))"
CMD ["python3", "/opt/mtgvault/server.py"]

FROM oven/bun:1-debian

RUN apt-get update && \
    apt-get install -y postgresql postgresql-contrib s3fs zip rsync sudo && \
    rm -rf /var/lib/apt/lists/*

RUN service postgresql start && \
    su - postgres -c "psql -c \"CREATE USER appuser WITH PASSWORD 'password' CREATEDB;\"" && \
    su - postgres -c "psql -c \"CREATE DATABASE appdb OWNER appuser;\"" && \
    service postgresql stop

RUN mkdir -p /home/user

WORKDIR /home/user

COPY template-nextjs/ /home/user/

RUN bun install

CMD ["/home/user/start.sh"]

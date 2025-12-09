FROM e2bdev/code-interpreter:latest 

WORKDIR /home/user

# Install PostgreSQL and utilities
RUN sudo apt-get update && \
    sudo apt-get install -y postgresql postgresql-contrib s3fs zip rsync && \
    sudo rm -rf /var/lib/apt/lists/*

# Configure PostgreSQL with default user and database
RUN sudo service postgresql start && \
    sudo -u postgres psql -c "CREATE USER appuser WITH PASSWORD 'password' CREATEDB;" && \
    sudo -u postgres psql -c "CREATE DATABASE appdb OWNER appuser;" && \
    sudo service postgresql stop

# Copy Next.js template
COPY template-nextjs/ /home/user/

# Install dependencies
RUN npm install

CMD ["/home/user/start.sh"]

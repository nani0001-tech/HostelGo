# HostelGo

HostelGo is a peer-to-peer hostel errand platform where students can request everyday items from other students.

## Project layout

- `frontend/` — React application powered by Vite
- `backend/` — Express API with a Mongoose database connection scaffold

The apps are intentionally separate and have independent package manifests.

## Run locally

Install dependencies in each app directory, then start each development server in its own terminal:

```sh
cd backend
npm install
npm run dev
```

```sh
cd frontend
npm install
npm run dev
```

The frontend runs at `http://localhost:5173` and proxies `/api` requests to the backend at `http://localhost:5000`.

Copy `backend/.env.example` to `backend/.env` and set `MONGODB_URI` and `JWT_SECRET` when you are ready to connect MongoDB Atlas. The API can start without a database URI during initial setup.

## Run with Docker

Install Docker Desktop (or Docker Engine with the Compose plugin), then create the ignored runtime environment file from the safe template:

```sh
cp .env.docker.example .env.docker
```

Set `MONGODB_URI` to your MongoDB Atlas URI and `JWT_SECRET` to a long random secret in `.env.docker`. The template contains placeholders only. Do not commit `.env.docker`.

Build and start the frontend and backend containers:

```sh
docker compose --env-file .env.docker build
docker compose --env-file .env.docker up -d
```

Open the frontend at <http://localhost:8080>. The backend health endpoint is <http://localhost:5000/api/health>. The browser calls the exposed backend address; the Docker service name is not used as the browser API URL. Set `VITE_API_URL` in `.env.docker` if the browser must use a different reachable backend address, and set `CLIENT_ORIGIN` to the frontend origin.

Ports bind to loopback by default. For browsers on another machine, set `DOCKER_BIND_ADDRESS` to a reachable host interface and set `VITE_API_URL` and `CLIENT_ORIGIN` to the corresponding browser-reachable URLs. Exposing the ports beyond the local machine should be done only on a trusted network with suitable host firewall rules.

Stop the containers with:

```sh
docker compose --env-file .env.docker down
```

MongoDB Atlas remains external to Docker. The application data continues to reside in Atlas when containers stop or are recreated.

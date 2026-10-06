pipeline {
    agent any

    environment {
        MONGODB_URI = credentials('hostelgo-mongodb-uri')
        JWT_SECRET = credentials('hostelgo-jwt-secret')
        COMPOSE_FILE = 'docker-compose.yml'
        DOCKER_ENV_FILE = '.env.docker'
        DOCKER_BIN = 'C:\\Users\\Aakash\\AppData\\Local\\Programs\\DockerDesktop\\resources\\bin'
        DOCKER_COMPOSE_BIN = 'C:\\Users\\Aakash\\.docker\\cli-plugins'
    }

    options {
        skipDefaultCheckout(true)
        disableConcurrentBuilds()
        timestamps()
    }

    stages {
        stage('Checkout') {
            steps {
                echo 'Checking out the main branch of HostelGo.'
                checkout([
                    $class: 'GitSCM',
                    branches: [[name: '*/main']],
                    userRemoteConfigs: [[url: 'https://github.com/nani0001-tech/HostelGo.git']]
                ])
            }
        }

        stage('Backend validation/test') {
    steps {
        echo 'Installing backend dependencies, starting the API, and running its offer negotiation smoke test.'

        dir('backend') {
            powershell 'npm ci'

            powershell '''
                $ErrorActionPreference = 'Stop'

                Write-Host "Starting HostelGo backend..."

                $backendProcess = Start-Process `
                    -FilePath "npm.cmd" `
                    -ArgumentList "start" `
                    -WorkingDirectory (Get-Location).Path `
                    -PassThru `
                    -WindowStyle Hidden

                Write-Host "Backend process started with PID $($backendProcess.Id)"

                Write-Host "Waiting for HostelGo API on port 5000..."

                $healthy = $false

                for ($attempt = 1; $attempt -le 24; $attempt++) {
                    try {
                        $response = Invoke-WebRequest `
                            -Uri "http://localhost:5000/api/health" `
                            -Method Get `
                            -TimeoutSec 5 `
                            -UseBasicParsing

                        if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 400) {
                            Write-Host "HostelGo backend is running successfully."
                            $healthy = $true
                            break
                        }
                    }
                    catch {
                        Write-Host "Backend not ready yet. Attempt $attempt/24..."
                        Start-Sleep -Seconds 5
                    }
                }

                if (-not $healthy) {
                    Write-Host "Backend failed to start."
                    if (-not $backendProcess.HasExited) {
                        Stop-Process -Id $backendProcess.Id -Force
                    }
                    throw "HostelGo backend did not become healthy on port 5000."
                }

                Write-Host "Running offer negotiation smoke test..."

                npm run test:offers

                if ($LASTEXITCODE -ne 0) {
                    throw "Offer negotiation smoke test failed."
                }

                Write-Host "Offer negotiation smoke test passed."

                if (-not $backendProcess.HasExited) {
                    Write-Host "Stopping temporary backend process..."
                    Stop-Process -Id $backendProcess.Id -Force
                    Write-Host "Temporary backend stopped."
                }
            '''
        }
    }
}

        stage('Frontend build/test') {
            steps {
                echo 'Installing frontend dependencies and building the production bundle.'
                dir('frontend') {
                    powershell 'npm ci'
                    powershell 'npm run build'
                }
            }
        }

        stage('Prepare Docker environment') {
    steps {
        echo 'Preparing Docker environment file from Jenkins credentials.'

        withCredentials([
            string(credentialsId: 'hostelgo-mongodb-uri', variable: 'MONGO_SECRET'),
            string(credentialsId: 'hostelgo-jwt-secret', variable: 'JWT_SECRET_SECRET')
        ]) {
            powershell '''
                $ErrorActionPreference = 'Stop'

                @"
MONGODB_URI=$env:MONGO_SECRET
JWT_SECRET=$env:JWT_SECRET_SECRET
DOCKER_BIND_ADDRESS=127.0.0.1
CLIENT_ORIGIN=http://localhost:8080
VITE_API_URL=http://localhost:5000/api
"@ | Set-Content -Path ".env.docker" -Encoding ascii

                Write-Host ".env.docker created successfully."
            '''
        }
    }
}

stage('Docker image build') {
    steps {
        echo 'Building the existing Compose backend and frontend images.'

        powershell '''
            $ErrorActionPreference = 'Stop'
            $env:Path = "$env:DOCKER_BIN;$env:DOCKER_COMPOSE_BIN;$env:Path"

            Write-Host "Docker location: $env:DOCKER_BIN"
            docker --version
            docker compose version

            if (-not (Test-Path -LiteralPath ".env.docker" -PathType Leaf)) {
                throw 'Required .env.docker file is missing from the Jenkins workspace.'
            }

            docker compose --env-file ".env.docker" -f "docker-compose.yml" build backend frontend

            if ($LASTEXITCODE -ne 0) {
                throw 'Docker Compose image build failed.'
            }
        '''
    }
}

        stage('Docker deployment') {
            steps {
                echo 'Deploying the existing Compose frontend and backend services.'
                powershell '''
                    $ErrorActionPreference = 'Stop'
                    $env:Path = "$env:DOCKER_BIN;$env:DOCKER_COMPOSE_BIN;$env:Path"

                    Write-Host "Docker location: $env:DOCKER_BIN"
                    docker --version
                    docker compose version

                    if (-not (Test-Path -LiteralPath $env:DOCKER_ENV_FILE -PathType Leaf)) {
                        throw 'Required .env.docker file is missing from the Jenkins workspace.'
                    }
                    docker compose --env-file $env:DOCKER_ENV_FILE -f $env:COMPOSE_FILE up -d --remove-orphans backend frontend
                    if ($LASTEXITCODE -ne 0) { throw 'Docker Compose deployment failed.' }
                '''
            }
        }

        stage('Deployment health verification') {
            steps {
                echo 'Waiting for the deployed backend and frontend HTTP health checks.'
                powershell '''
                    $ErrorActionPreference = 'Stop'
                    $checks = @(
                        @{ Name = 'Backend'; Url = 'http://localhost:5000/api/health' },
                        @{ Name = 'Frontend'; Url = 'http://localhost:8080/' }
                    )
                    foreach ($check in $checks) {
                        $healthy = $false
                        for ($attempt = 1; $attempt -le 18; $attempt++) {
                            try {
                                $response = Invoke-WebRequest -Uri $check.Url -Method Get -TimeoutSec 5 -UseBasicParsing
                                if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 400) {
                                    Write-Host "$($check.Name) is responding successfully."
                                    $healthy = $true
                                    break
                                }
                            } catch {
                                Start-Sleep -Seconds 5
                            }
                        }
                        if (-not $healthy) {
                            throw "$($check.Name) health check failed at $($check.Url)."
                        }
                    }
                '''
            }
        }
    }

post {
    always {
        powershell '''
            if (Test-Path -LiteralPath ".env.docker") {
                Remove-Item -LiteralPath ".env.docker" -Force
                Write-Host ".env.docker removed from Jenkins workspace."
            }
        '''
    }
}
}

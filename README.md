# Workshop Game

> **End-to-End Containerization and Cloud Deployment** — Workshop Demo Application

<p align="center">
  <strong>A high-speed, neon-styled typing game</strong><br/>
  Type falling words before they breach the firewall. Precision is key. Speed is survival.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/React-19-61dafb?logo=react" alt="React 19" />
  <img src="https://img.shields.io/badge/TypeScript-5.8-3178c6?logo=typescript" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Vite-6-646cff?logo=vite" alt="Vite" />
  <img src="https://img.shields.io/badge/Tailwind-4-38bdf8?logo=tailwindcss" alt="Tailwind CSS" />
  <img src="https://img.shields.io/badge/Docker-Ready-2496ed?logo=docker" alt="Docker" />
</p>

---

## Overview

**Workshop Game** is a fast-paced typing game. Words cascade down the screen—type them accurately before they reach the bottom to score points and survive.

---

## Prerequisites

- **Local:** Node.js 20+ ([nvm](https://github.com/nvm-sh/nvm) recommended)
- **EC2:** Amazon Linux 2 or Amazon Linux 2023, AWS CLI configured

> **Repository:** [github.com/duvarakesh1907/KCT-workshop](https://github.com/duvarakesh1907/KCT-workshop)

---

## 1. Run Locally (After Clone)

```bash
# Clone the repository
git clone https://github.com/duvarakesh1907/KCT-workshop.git
cd KCT-workshop

# Install dependencies
npm install

# Start development server
npm run dev
```

Open **http://localhost:3000** in your browser.

---

## 2. Run with Docker (Local)

```bash
# Clone (if not already done)
git clone https://github.com/duvarakesh1907/KCT-workshop.git
cd KCT-workshop

# Build the image
docker build -t workshop-game .

# Run the container
docker run -d -p 8080:80 --name workshop-game workshop-game
```

Open **http://localhost:8080** in your browser.

**Stop and remove:**
```bash
docker stop workshop-game
docker rm workshop-game
```

---

## 3. EC2 + Amazon ECR Deployment

Follow these steps on an **EC2 instance** running **Amazon Linux 2** or **Amazon Linux 2023**.

### Step 1: Install Docker

**Amazon Linux 2023:**
```bash
sudo dnf update -y
sudo dnf install docker -y
sudo systemctl start docker
sudo systemctl enable docker
sudo usermod -aG docker $USER
newgrp docker
```

**Amazon Linux 2:**
```bash
sudo yum update -y
sudo yum install docker -y
sudo systemctl start docker
sudo systemctl enable docker
sudo usermod -aG docker ec2-user
newgrp docker
```

**Verify installation:**
```bash
docker --version
```

### Step 2: Install Docker Compose (Optional)

**Amazon Linux 2023:**
```bash
sudo dnf install docker-compose-plugin -y
```

**Amazon Linux 2:**
```bash
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
```

**Verify (AL2023 uses `docker compose`, AL2 uses `docker-compose`):**
```bash
docker compose version
# or
docker-compose --version
```

### Step 3: Clone the Repository

```bash
git clone https://github.com/duvarakesh1907/KCT-workshop.git
cd KCT-workshop
```

### Step 4: Create ECR Repository (One-time, in AWS Console or CLI)

**Using AWS CLI:**
```bash
aws ecr create-repository --repository-name workshop-game --region ap-south-1
```

> Replace `ap-south-1` with your preferred region (e.g., `us-east-1`).

**Note the repository URI** from the output:
```
"repositoryUri": "123456789012.dkr.ecr.ap-south-1.amazonaws.com/workshop-game"
```

### Step 5: Build the Docker Image

```bash
docker build -t workshop-game .
```

### Step 6: Authenticate Docker to ECR

```bash
aws ecr get-login-password --region ap-south-1 | docker login --username AWS --password-stdin 123456789012.dkr.ecr.ap-south-1.amazonaws.com
```

> Replace:
> - `ap-south-1` with your AWS region
> - `123456789012` with your AWS account ID

**Get your AWS account ID:**
```bash
aws sts get-caller-identity --query Account --output text
```

### Step 7: Tag the Image for ECR

```bash
docker tag workshop-game:latest 123456789012.dkr.ecr.ap-south-1.amazonaws.com/workshop-game:latest
```

> Replace `123456789012` and `ap-south-1` with your account ID and region.

### Step 8: Push to ECR

```bash
docker push 123456789012.dkr.ecr.ap-south-1.amazonaws.com/workshop-game:latest
```

### Step 9: Run the Container from ECR

```bash
docker run -d -p 8080:80 --name workshop-game 123456789012.dkr.ecr.ap-south-1.amazonaws.com/workshop-game:latest
```

**Access the app:** `http://<EC2-PUBLIC-IP>:8080`

> Ensure EC2 Security Group allows inbound traffic on port 8080.

**Stop and remove:**
```bash
docker stop workshop-game
docker rm workshop-game
```

---

## Quick Reference: Full ECR Workflow

Set these variables once (replace with your values):

```bash
export AWS_ACCOUNT_ID=123456789012
export AWS_REGION=ap-south-1
export ECR_URI=${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/workshop-game
```

Then run:

```bash
# 1. Clone
git clone https://github.com/duvarakesh1907/KCT-workshop.git
cd KCT-workshop

# 2. Build
docker build -t workshop-game .

# 3. Login to ECR
aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $ECR_URI

# 4. Tag & Push
docker tag workshop-game:latest $ECR_URI:latest
docker push $ECR_URI:latest

# 5. Run (stop/remove existing container first if needed)
docker rm -f workshop-game 2>/dev/null
docker run -d -p 8080:80 --name workshop-game $ECR_URI:latest
```

---

## How to Play

1. Press **Enter** or click "Initialize System" to start
2. Type the first letter of any falling word to target it (highlighted in cyan)
3. Complete the entire word before it reaches the red zone at the bottom
4. You have 5 lives; each word that reaches the bottom costs 1 life
5. Score increases with word length and difficulty multiplier

---

## Tech Stack

| Category   | Technology        |
| ---------- | ----------------- |
| Framework  | React 19          |
| Language   | TypeScript 5.8    |
| Build Tool | Vite 6            |
| Styling    | Tailwind CSS 4    |
| Production | Nginx in Docker   |

---

## Project Structure

```
workshop-game/
├── src/
│   ├── components/NeonTypeGame.tsx
│   ├── data/words.ts
│   ├── utils/SoundManager.ts
│   ├── app.tsx
│   ├── main.tsx
│   └── index.css
├── Dockerfile
├── nginx.conf
├── docker-compose.yml
└── package.json
```

---

## License

Licensed under the Apache License 2.0.

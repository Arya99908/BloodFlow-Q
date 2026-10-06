# Start BloodFlow-Q on Your Computer

This guide assumes you are new to terminals and Python environments. The setup keeps Python packages inside this project folder's `.venv/` directory and JavaScript packages inside `frontend/node_modules/`. It does not install BloodFlow-Q packages globally.

## Before starting

BloodFlow-Q's current local setup needs:

- macOS, Linux, or Windows with WSL (this project has been checked on macOS).
- Python 3.11 or newer. The inspected development machine has Python 3.14.7.
- Node.js and npm. The inspected machine has Node.js 26.10.0 and npm 12.2.0.
- An internet connection during the first setup, so the package managers can download dependencies.

Git is useful for downloading and tracking project files, but it is not required to start a project folder you already have. Git 2.54.0 is installed on the inspected Mac; this folder is not currently initialized as a Git repository.

## 1. Open Terminal

On a Mac, press **Command + Space**, type **Terminal**, and press **Return**. On Windows, open a WSL terminal. On Linux, open your usual terminal application.

The terminal is a text window where you enter commands. Commands below should be typed one at a time, then you press **Return**.

## 2. Enter the project folder

In Terminal, enter:

```bash
cd "$HOME/Desktop/BLOOD UNIT DESPENSER"
```

This path matches the current Mac checkout. If you saved the project elsewhere, type `cd ` (including the space), drag the project folder from Finder into Terminal, then press **Return**. The terminal prompt should now refer to the BloodFlow-Q project folder.

## 3. Activate the environment if needed

The project uses a private Python environment named `.venv`. If it already exists, activate it with:

```bash
source .venv/bin/activate
```

Your prompt will usually show `(.venv)` when it is active. The startup scripts use `.venv` directly, so you can also skip activation after setup. To leave the environment later, enter `deactivate`.

If `.venv` has not been created, continue to the next step. The setup script creates it.

## 4. Install project dependencies

Run:

```bash
./setup.sh
```

The script checks for `python3`, Node.js, and npm. It creates `.venv/` if necessary, installs packages listed in `requirements.txt` into that environment, then installs frontend packages using `frontend/package-lock.json`. It does not use `sudo`, change system Python, or install npm packages globally. You need to run setup again only when dependencies change or when you set up a new computer.

If the script says a command is missing, it will name it. Install Python 3 or Node.js from that project's official website, reopen Terminal, and run `./setup.sh` again. The current inspected computer already has the needed tools and dependencies, so no installation or version changes were necessary here.

## 5. Start the backend

If you want to start only the Python API, run:

```bash
./scripts/start-backend.sh
```

Leave that terminal window open. The API should be available at [http://127.0.0.1:8000](http://127.0.0.1:8000). Its interactive documentation is at [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs).

## 6. Start the frontend

Open a **second** Terminal window or tab. Repeat Step 2 to enter the project folder, then run:

```bash
./scripts/start-frontend.sh
```

The frontend development server usually starts at `http://127.0.0.1:5173`. Keep this terminal open too. The startup script uses strict ports so it cannot quietly start on an unexpected address. If a port is already in use, stop the older server with Control+C in its terminal, or choose unused ports with the optional settings below.

### Start both with one command

After Step 4 has completed, you can start both services with a single command from the project folder:

```bash
./dev.sh
```

This is the recommended everyday start command. It prints the frontend and API addresses. Keep the terminal open while using the application.

Optional port settings are available when the defaults are already in use. For example:

```bash
BLOODFLOW_API_PORT=8001 \
BLOODFLOW_FRONTEND_PORT=5174 \
VITE_API_BASE_URL=http://127.0.0.1:8001 \
./dev.sh
```

Open the frontend address printed by the script. When changing the API port, set `VITE_API_BASE_URL` to that same API address.

## 7. Open the application in a browser

Visit [http://127.0.0.1:5173](http://127.0.0.1:5173). The frontend requests scenario data and optimization results from the API at `http://127.0.0.1:8000`.

If the browser shows an API connection message, check that the backend terminal is still running and that it says the API started at the configured port (8000 by default).

## 8. Stop the servers

- If you started both with `./dev.sh`, return to that terminal and press **Control + C** once. The script stops both services.
- If you started backend and frontend separately, press **Control + C** in each terminal window.
- Close the terminal windows only after the server has stopped.

## What was checked on the current development computer

The inspected computer is an Apple Silicon Mac running macOS (Darwin 27.0). Python 3.14.7, pip 26.2.1, Node.js 26.10.0, npm 12.2.0, and Git 2.54.0 are available. The local Python environment has FastAPI 0.142.2, Uvicorn 0.54.0, Qiskit 2.5.2, and Qiskit Aer 0.17.2. The frontend has React 18.3.1 and Vite 6.4.4 installed. No dependencies needed installing or upgrading during this inspection.

Qiskit Aer is tested through its supported `AerSimulator` backend workflow (`QuantumCircuit`, `transpile`, `simulator.run(...).result().get_counts()`) as shown in [official Aer simulator documentation](https://qiskit.github.io/qiskit-aer/tutorials/1_aersimulator.html). The existing BloodFlow-Q QAOA uses that workflow and imports successfully in the checked environment.

This project uses synthetic logistics scenarios only. It is not a clinical system. See [docs/SECURITY_AND_SAFETY.md](SECURITY_AND_SAFETY.md).

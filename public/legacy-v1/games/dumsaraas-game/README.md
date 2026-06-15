# dumsaraas-game

## Overview
dumsaraas-game is a full-stack application that features a React frontend and a Node.js backend with real-time communication capabilities using Socket.IO. This project serves as a template for building interactive web applications.

## Project Structure
```
dumsaraas-game
├── client/       ← React frontend
│   ├── src/     ← Source files for the React application
│   ├── package.json  ← Configuration for the React frontend
│   ├── tsconfig.json  ← TypeScript configuration for the React frontend
│   └── public/   ← Public assets for the React application
├── server/       ← Node + Express + Socket.IO backend
│   ├── src/     ← Source files for the Node.js application
│   ├── package.json  ← Configuration for the Node backend
│   └── tsconfig.json  ← TypeScript configuration for the Node backend
└── README.md     ← Project documentation
```

## Getting Started

### Prerequisites
- Node.js (version 14 or higher)
- npm (Node package manager)

### Installation

1. Clone the repository:
   ```
   git clone https://github.com/yourusername/dumsaraas-game.git
   cd dumsaraas-game
   ```

2. Install dependencies for the client:
   ```
   cd client
   npm install
   ```

3. Install dependencies for the server:
   ```
   cd ../server
   npm install
   ```

### Running the Application

1. Start the server:
   ```
   cd server
   npm start
   ```

2. Start the client:
   ```
   cd ../client
   npm start
   ```

The application should now be running on `http://localhost:3000` for the client and `http://localhost:5000` for the server.

## Usage
- The React frontend communicates with the Node.js backend using RESTful API endpoints and Socket.IO for real-time features.
- You can modify the components in the `client/src/components` directory to customize the frontend.
- The backend routes can be adjusted in the `server/src/routes` directory to add or modify API endpoints.

## Contributing
Contributions are welcome! Please open an issue or submit a pull request for any enhancements or bug fixes.

## License
This project is licensed under the MIT License. See the LICENSE file for details.
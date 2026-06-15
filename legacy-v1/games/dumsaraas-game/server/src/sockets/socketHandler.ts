import { Server } from "socket.io";

export const setupSocket = (server) => {
    const io = new Server(server);

    io.on("connection", (socket) => {
        console.log("A user connected:", socket.id);

        socket.on("disconnect", () => {
            console.log("User disconnected:", socket.id);
        });

        // Example of handling a custom event
        socket.on("message", (data) => {
            console.log("Message received:", data);
            // Broadcast the message to all connected clients
            io.emit("message", data);
        });
    });

    return io;
};
type Task = () => Promise<any>

class RoomQueue {
  private queue: Task[] = []
  private processing = false

  /**
   * Pushes a task to the queue and returns a promise that resolves when the task finishes.
   */
  public add<T>(task: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const wrappedTask = async () => {
        try {
          const result = await task()
          resolve(result)
        } catch (err) {
          reject(err)
        }
      }
      this.queue.push(wrappedTask)
      this.processNext()
    })
  }

  private async processNext() {
    if (this.processing || this.queue.length === 0) return
    this.processing = true
    
    const task = this.queue.shift()
    if (task) {
      try {
        await task()
      } catch (err) {
        // Errors are captured inside wrappedTask reject
      }
    }
    
    this.processing = false
    this.processNext()
  }
}

const roomQueues: Record<string, RoomQueue> = {}

/**
 * Gets or creates a RoomQueue for a roomCode
 */
export function getRoomQueue(roomCode: string): RoomQueue {
  const normalized = roomCode.trim().toUpperCase()
  if (!roomQueues[normalized]) {
    roomQueues[normalized] = new RoomQueue()
  }
  return roomQueues[normalized]
}

/**
 * Clean up the queue for a closed room
 */
export function deleteRoomQueue(roomCode: string) {
  const normalized = roomCode.trim().toUpperCase()
  delete roomQueues[normalized]
}

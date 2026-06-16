import pino from 'pino'
import * as Sentry from '@sentry/node'

// Initialize Pino Structured Logger
export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  formatters: {
    level: (label) => {
      return { level: label.toUpperCase() }
    }
  },
  timestamp: pino.stdTimeFunctions.isoTime
})

// Initialize Sentry SDK
export const initSentry = () => {
  const dsn = process.env.SENTRY_DSN
  if (dsn) {
    Sentry.init({
      dsn,
      environment: process.env.NODE_ENV || 'development',
      tracesSampleRate: 0.1
    })
    logger.info('Sentry Error Tracking initialized successfully.')
  } else {
    logger.warn('Sentry DSN not found in environment variables. Error reporting is disabled.')
  }
}

/**
 * Capture and report errors with structured context to Sentry and Pino logs.
 */
export const logError = (err: Error, context?: Record<string, any>) => {
  logger.error({ err, ...context }, err.message)
  
  if (process.env.SENTRY_DSN) {
    Sentry.withScope((scope) => {
      if (context) {
        Object.keys(context).forEach((key) => {
          scope.setExtra(key, context[key])
        })
      }
      Sentry.captureException(err)
    })
  }
}

const config = require('./config.js');
const os = require('os');
const { set } = require('./service.js');

class Metrics {
  constructor() {
    this.methodCounts = {total: 0};
    this.successfulAuthCount = 0;
    this.failedAuthCount = 0;
    this.activeSessions = new Set();
    this.userTimeouts = new Map();
    this.pizzaCount = 0;
    this.failedOrderCount = 0;
    this.revenue = 0;
    this.lastPizzaCreationLatency = 0;
    this.lastRequestLatency = 0;

    // This will periodically sent metrics to Grafana
    const timer = setInterval(() => {
      for (const type in this.methodCounts) {
        this.sendMetricToGrafana('requests', {method: type}, 'count', this.methodCounts[type]);
      }
      this.sendMetricToGrafana('cpu', {}, 'pct', this.getCpuUsagePercentage());
      this.sendMetricToGrafana('memory', {}, 'pct', this.getMemoryUsagePercentage());
      this.sendMetricToGrafana('auth_success', {}, 'count', this.successfulAuthCount);
      this.sendMetricToGrafana('auth_failure', {}, 'count', this.failedAuthCount);
      this.sendMetricToGrafana('active_sessions', {}, 'count', this.activeSessions.size);
      this.sendMetricToGrafana('pizza_count', {}, 'count', this.pizzaCount);
      this.sendMetricToGrafana('failed_orders', {}, 'count', this.failedOrderCount);
      this.sendMetricToGrafana('revenue', {}, 'count', this.revenue);
      this.sendMetricToGrafana('last_pizza_creation_latency', {}, 'ms', this.lastPizzaCreationLatency);
      this.sendMetricToGrafana('last_request_latency', {}, 'ms', this.lastRequestLatency);
    }, 10000);
    timer.unref();
  }

  requestTracker = (req, res, next) => {
    const startTime = Date.now();
    res.on('finish', () => {
      const latency = Date.now() - startTime;
      this.lastRequestLatency = latency;
    });

    this.methodCounts.total++;
    this.methodCounts[req.method] = this.methodCounts[req.method] ? this.methodCounts[req.method] + 1 : 1;
    next();
  }

  authOrderTracker = (req, res, next) => {
    if (req.path.startsWith('/api/auth') && req.method === 'PUT') {
      const originalSend = res.send.bind(res);

      res.send = (body) => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          this.successfulAuthCount++;
        } else if (res.statusCode >= 400 && res.statusCode < 500) {
          this.failedAuthCount++;
        }
        originalSend(body);
      };
    } else if (req.path.startsWith('/api/order') && req.method === 'POST') {
      const originalSend = res.send.bind(res);
      const startTime = Date.now();

      res.send = (body) => {
        const latency = Date.now() - startTime;
        this.lastPizzaCreationLatency = latency;

        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            this.pizzaCount += body.order.items.length;
            this.revenue += body.order.items.reduce((acc, item) => acc + item.price, 0);
          } catch (e) {}
        } else if (res.statusCode >= 400) {
          this.failedOrderCount++;
        }
        originalSend(body);
      }
    }
    next();
  }

  userTracker = (req, res, next) => {
    if (req.headers.authorization) {
      this.activeSessions.add(req.headers.authorization);
      if (this.userTimeouts.has(req.headers.authorization)) {
        clearTimeout(this.userTimeouts.get(req.headers.authorization));
      }
      this.userTimeouts.set(req.headers.authorization, setTimeout(() => {
        this.activeSessions.delete(req.headers.authorization);
        this.userTimeouts.delete(req.headers.authorization);
      }, 15 * 60 * 1000));
    }
    next();
  }

  getCpuUsagePercentage() {
    const cpuUsage = os.loadavg()[0] / os.cpus().length;
    return cpuUsage.toFixed(2) * 100;
  }
  
  getMemoryUsagePercentage() {
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;
    const memoryUsage = (usedMemory / totalMemory) * 100;
    return memoryUsage.toFixed(2);
  }

  sendMetricToGrafana(metricPrefix, tags, metricName, metricValue) {
    const tagsString = Object.keys(tags).map((key) => `,${key}=${tags[key]}`).join('');
    const metric = `${metricPrefix},source=${config.metrics.source}${tagsString} ${metricName}=${metricValue}`;

    fetch(`${config.metrics.url}`, {
      method: 'post',
      body: metric,
      headers: { Authorization: `Bearer ${config.metrics.userId}:${config.metrics.apiKey}` },
    })
      .then((response) => {
        if (!response.ok) {
          console.error('Failed to push metrics data to Grafana');
        }
      })
      .catch((error) => {
        console.error('Error pushing metrics:', error);
      });
  }
}

const metrics = new Metrics();
module.exports = metrics;
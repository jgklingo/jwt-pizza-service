const config = require('./config.js');
const os = require('os');

class Metrics {
  constructor() {
    this.methodCounts = {total: 0};
    this.successfulAuthCount = 0;
    this.failedAuthCount = 0;

    // This will periodically sent metrics to Grafana
    const timer = setInterval(() => {
      for (const type in this.methodCounts) {
        this.sendMetricToGrafana('requests', {method: type}, 'count', this.methodCounts[type]);
      }
      this.sendMetricToGrafana('cpu', {}, 'pct', this.getCpuUsagePercentage());
      this.sendMetricToGrafana('memory', {}, 'pct', this.getMemoryUsagePercentage());
      this.sendMetricToGrafana('auth_success', {}, 'count', this.successfulAuthCount);
      this.sendMetricToGrafana('auth_failure', {}, 'count', this.failedAuthCount);
    }, 10000);
    timer.unref();
  }

  requestTracker = (req, res, next) => {
    this.methodCounts.total++;
    this.methodCounts[req.method] = this.methodCounts[req.method] ? this.methodCounts[req.method] + 1 : 1;
    next();
  }

  authTracker = (req, res, next) => {
    if (req.path.startsWith('/api/auth')) {
      const originalSend = res.send.bind(res);

      res.send = (body) => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          this.successfulAuthCount++;
        } else if (res.statusCode >= 400 && res.statusCode < 500) {
          this.failedAuthCount++;
        }
        originalSend(body);
      };
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
        } else {
          console.log(`Pushed ${metric}`);
        }
      })
      .catch((error) => {
        console.error('Error pushing metrics:', error);
      });
  }
}

const metrics = new Metrics();
module.exports = metrics;
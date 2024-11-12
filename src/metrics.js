const config = require('./config.json');

// Need to implement requestTracker function //

class Metrics {
  constructor() {
    this.totalRequests = 0;
    this.postRequests = 0;
    this.deleteRequests = 0;
    this.getRequests = 0;

    // This will periodically sent metrics to Grafana
    const timer = setInterval(() => {
      this.sendMetricToGrafana('request', 'all', 'total', this.totalRequests);
      this.sendMetricToGrafana('request', 'post', 'total', this.postRequests);
      this.sendMetricToGrafana('request', 'delete', 'total', this.deleteRequests);
      this.sendMetricToGrafana('request', 'get', 'total', this.getRequests);
    }, 10000);
    timer.unref();
  }

  incrementPostRequests() {
    this.totalRequests++;
    this.postRequests++;
  }

  incrementDeleteRequests() {
    this.totalRequests++;
    this.deleteRequests++;
  }

  incrementGetRequests() {
    this.totalRequests++;
    this.getRequests++;
  }

  sendMetricToGrafana(metricPrefix, httpMethod, metricName, metricValue) {
    const metric = `${metricPrefix},source=${config.source},method=${httpMethod} ${metricName}=${metricValue}`;

    fetch(`${config.url}`, {
      method: 'post',
      body: metric,
      headers: { Authorization: `Bearer ${config.userId}:${config.apiKey}` },
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
import { Injectable } from '@nestjs/common';

@Injectable()
export class BusinessSkillsProvider {
  getAllBusinessSkills(): string {
    return [
      this.getRevenueAnalysisSkill(),
      this.getCustomerChurnSkill(),
      this.getMarketComparisonSkill(),
    ].join('\n\n---\n\n');
  }

  getRevenueAnalysisSkill(): string {
    return `## Revenue Analysis Rules

When analyzing revenue, apply these business rules:
- **Gross Revenue** = SUM of all booking payments (base price + addon prices)
- **Net Revenue** = Gross Revenue - platform fees (8% platform commission) - refunds
- **Revenue per Event** = Net Revenue / total events
- **Revenue per Attendee** = Net Revenue / total bookings
- **Healthy margin threshold**: Net Revenue should be >= 60% of Gross Revenue
- **Seasonality adjustment**: Compare current period vs same period last year, not vs prior month
- If refund rate > 5%, flag as potential quality issue`;
  }

  getCustomerChurnSkill(): string {
    return `## Customer Churn & Retention Rules

When analyzing customer behavior, apply these rules:
- **Active customer**: Has at least 1 booking in the trailing 90 days
- **At-risk customer**: Had bookings in prior 90-day window but none in trailing 90 days
- **Churned customer**: No bookings in 180+ days
- **Churn rate** = Churned customers / Total customers (over the period)
- **Repeat rate** = Customers with 2+ bookings / Total customers
- **Healthy repeat rate**: >= 30%
- **Healthy churn rate**: <= 15% per quarter
- Flag segments where churn rate exceeds 20% — these need retention campaigns`;
  }

  getMarketComparisonSkill(): string {
    return `## Market Comparison Benchmarks

When comparing vendor performance against market averages:
- **Fill rate benchmark**: Industry average for event venues is 65-75%
- **Avg ticket price**: Compare against similar categories in same city, not globally
- **Booking lead time**: Healthy range is 14-28 days for standard events
- **Cancellation rate**: Industry average is 3-5%; > 8% requires investigation
- **Revenue per sq ft**: Only compare against venues in the same city and category
- **Anonymity requirement**: Never expose individual vendor data — only aggregate (min 5 vendors per bucket)
- If a vendor's metrics are significantly below benchmarks (>20% deviation), provide specific, actionable recommendations`;
  }
}

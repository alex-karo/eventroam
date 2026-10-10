## MODIFIED Requirements

### Requirement: Date and duration shortcuts resolve to ordinary bounds

The UI SHALL offer six buttons for the visitor’s current local calendar month and the following five months, labeled with English month and year, plus inclusive custom date selection and one-day, two-to-three-day, and four-or-more-day duration shortcuts. A month button SHALL fill both pending date bounds with that entire calendar month and indicate selection only when both pending bounds exactly match it. The UI SHALL NOT display a native Month field, This weekend button, or Upcoming and ongoing button. Applied shortcuts SHALL serialize as resolved date or duration bounds.

#### Scenario: A nearby month is selected

- **WHEN** a visitor selects a month button
- **THEN** the pending From and To fields show the first and last dates of that month, the button indicates selection, and applying stores those dates in the URL

#### Scenario: Months cross the year boundary

- **WHEN** the current month is December
- **THEN** the six choices start with December of the current year and continue January through May of the next year


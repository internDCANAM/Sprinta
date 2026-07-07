# Logging and Monitoring Policy

## Purpose

This document describes how SprintaIso handles logging and monitoring in relation to ISO/IEC 27001 A.8.15 and A.8.16.

## Logged Security Events

The application records security-relevant events such as:

- Login rate limit exceeded
- Unauthorized access attempts
- Forbidden access attempts
- Unexpected backend errors

## Retention

Security events should be retained for at least 180 days.

Application logs should be retained for at least 90 days in production.

## Protection

Logs must not contain:

- Plain-text passwords
- JWT secrets
- Encryption keys
- Full bank account numbers
- Full personal identity numbers

Sensitive values should be masked or hashed.

## Monitoring

High-severity security events should be reviewed regularly.

Future alert integrations may include:

- Email
- Slack
- Microsoft Teams
- SIEM tools
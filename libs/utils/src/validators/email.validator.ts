import { ValidationArguments, ValidatorConstraint, ValidatorConstraintInterface } from 'class-validator';

@ValidatorConstraint({ name: 'isValidEmail', async: false })
export class IsValidEmailConstraint implements ValidatorConstraintInterface {
  validate(email: string, args: ValidationArguments) {
    if (!email) return false;

    // Basic email regex
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) return false;

    // Additional checks
    const [localPart, domain] = email.split('@');

    // Local part length
    if (localPart.length > 64) return false;

    // Domain length
    if (domain.length > 255) return false;

    // Domain parts
    const domainParts = domain.split('.');
    if (domainParts.length < 2) return false;

    // Each domain part
    for (const part of domainParts) {
      if (part.length > 63) return false;
      if (!/^[a-zA-Z0-9-]+$/.test(part)) return false;
      if (part.startsWith('-') || part.endsWith('-')) return false;
    }

    return true;
  }

  defaultMessage(args: ValidationArguments) {
    return 'Email must be a valid email address';
  }
}
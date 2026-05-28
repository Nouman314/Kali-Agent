const FormUtils = {
    validateEmail(email) {
        if (!email) return { isValid: false, message: 'Please enter your email address' };
        const pattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return pattern.test(email)
            ? { isValid: true }
            : { isValid: false, message: 'Please enter a valid email address' };
    },

    LoginFormBase: class {
        constructor(options = {}) {
            const {
                submitButtonSelector,
                formGroupSelector,
                cardSelector,
                hideOnSuccess = [],
                validators = {},
            } = options;

            this.form = document.querySelector('form');
            this.submitButton = this.form?.querySelector(submitButtonSelector);
            this.card = cardSelector ? document.querySelector(cardSelector) : null;
            this.hideOnSuccess = hideOnSuccess;
            this.validators = validators;
            this.successMessage = document.querySelector('#successMessage');

            this.bindEvents();
            if (typeof this.decorate === 'function') {
                this.decorate();
            }
        }

        bindEvents() {
            if (!this.form) return;
            this.form.addEventListener('submit', this.handleSubmit.bind(this));
        }

        handleSubmit(event) {
            event.preventDefault();
            if (this.validate()) {
                this.onSuccess();
            }
        }

        validate() {
            if (!this.form) return false;
            let isValid = true;
            const formData = new FormData(this.form);

            Object.entries(this.validators).forEach(([fieldName, validator]) => {
                const value = (formData.get(fieldName) || '').toString().trim();
                const result = typeof validator === 'function'
                    ? validator(value)
                    : { isValid: true };

                const errorElement = this.form.querySelector(`#${fieldName}Error`);
                if (!result.isValid) {
                    isValid = false;
                    if (errorElement) {
                        errorElement.textContent = result.message || 'Please fill out this field.';
                    }
                } else if (errorElement) {
                    errorElement.textContent = '';
                }
            });

            return isValid;
        }

        onSuccess() {
            this.hideOnSuccess.forEach(selector => {
                document.querySelectorAll(selector).forEach(el => {
                    el.style.display = 'none';
                });
            });

            if (this.successMessage) {
                this.successMessage.style.display = 'block';
            }

            if (this.submitButton) {
                this.submitButton.disabled = true;
            }
        }
    },
};

// Soft Minimalism Login Form
class SoftMinimalismLoginForm extends FormUtils.LoginFormBase {
    constructor() {
        super({
            submitButtonSelector: '.comfort-button',
            formGroupSelector: '.soft-field',
            cardSelector: '.soft-card',
            hideOnSuccess: ['.comfort-social', '.comfort-signup', '.gentle-divider'],
            validators: {
                email: FormUtils.validateEmail,
                password: (v) => {
                    if (!v) return { isValid: false, message: 'Please enter your password' };
                    if (v.length < 6) return { isValid: false, message: 'Password must be at least 6 characters' };
                    return { isValid: true };
                },
            },
        });
    }

    decorate() {
        // Soft hover lift on field containers
        [this.form.querySelector('#email'), this.form.querySelector('#password')].forEach(input => {
            if (!input) return;
            input.setAttribute('placeholder', ' ');
            input.addEventListener('focus', () => {
                const c = input.closest('.field-container');
                if (c) c.style.transform = 'translateY(-1px)';
            });
            input.addEventListener('blur', () => {
                const c = input.closest('.field-container');
                if (c) c.style.transform = 'translateY(0)';
            });
        });

        // Press effect on interactive elements
        document.querySelectorAll('.comfort-button, .social-soft, .gentle-checkbox').forEach(el => {
            el.addEventListener('mousedown', () => { el.style.transform = 'scale(0.98)'; });
            el.addEventListener('mouseup', () => { el.style.transform = 'scale(1)'; });
            el.addEventListener('mouseleave', () => { el.style.transform = 'scale(1)'; });
        });
    }
}

document.addEventListener('DOMContentLoaded', () => new SoftMinimalismLoginForm());
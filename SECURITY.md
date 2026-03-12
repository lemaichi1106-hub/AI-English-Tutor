# 🛡️ Security Policy

## Incident Reporting

If you believe you have found a security vulnerability, please report it to us as responsibly as possible. Do **NOT** create an issue/pull request or public post about the security issue.

### How To Report A Vulnerability

Please send a private message to our security team:
- **Email:** security@lemaichi1106-hub.com (replace with real email)
- **GitHub:** @lemaichi1106-hub

We will respond within 48 hours.

---

## Security Measures

This project follows these security best practices:

### 🔐 API Key Management
- ❌ **NEVER** commit `.env` files to Git
- ✅ Use runtime-loaded credentials via OCP Secrets
- ✅ Rotate keys regularly (every 90 days recommended)

### 📦 Container Security
- Runs as **non-root user** only (`appuser`)
- Multi-stage builds to minimize attack surface
- Minimal base image (`node:20-alpine`)
- Regular dependency updates

### 🔒 Input Validation
All API requests to Google AI must validate inputs:
```typescript
// Example validation
generateResponse(input: string): Promise<string> {
  if (!input || input.length > 500) {
    throw new Error('Input too long');
  }
  // ... rest of logic
}
```

### 📜 Dependency Management
- All dependencies from `npm` registry (official, audited)
- Regular dependency updates (`npm audit`)
- No third-party packages with known CVEs

---

## Compliance & Standards

This project aims to comply with:
- ✅ OWASP Top 10 for Web Application Security
- ✅ CIS Kubernetes Benchmarks (for OCP deployment)
- ✅ Docker Content Trust best practices

---

## Threat Model

### **Threats We Protect Against:**
1. **Credential Theft** → Use OCP Secrets, runtime loading only
2. **Denial of Service** → Rate limiting via backend API calls
3. **Cross-Site Scripting (XSS)** → React strict mode, sanitize user input
4. **Dependency Confusion** → Scoped private npm registry if needed
5. **Container Escapes** → User namespaces, read-only file system

---

## Contact

**Security Team:** lemaichi1106-hub  
**Project Maintainer:** [@lemaichi1106-hub](https://github.com/lemaichi1106-hub)

---

*Last updated: 2026-03-12*
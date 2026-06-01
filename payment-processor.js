// ==================== PAYMENT PROCESSING SYSTEM ====================
// Procesar pagos y enviar confirmaciones

class PaymentProcessor {
  constructor() {
    this.db = null;
  }

  async initializeDatabase(db) {
    this.db = db;
  }

  // Registrar pago en Firebase
  async recordPayment(paymentData) {
    try {
      const paymentId = `PAY-${Date.now()}`;
      
      await this.db.collection('payments').doc(paymentId).set({
        id: paymentId,
        email: paymentData.email,
        fullName: paymentData.fullName,
        plan: paymentData.plan,
        amount: parseFloat(paymentData.amount),
        method: paymentData.method,
        reference: paymentData.reference,
        status: 'pending',
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
      });

      return paymentId;
    } catch (error) {
      console.error('❌ Error registrando pago:', error);
      throw error;
    }
  }

  // Confirmar pago
  async confirmPayment(paymentId, proofUrl) {
    try {
      await this.db.collection('payments').doc(paymentId).update({
        status: 'confirmed',
        proofUrl: proofUrl,
        confirmedAt: new Date().toISOString()
      });

      await this.activateUserPlan(paymentId);
      return true;
    } catch (error) {
      console.error('❌ Error confirmando pago:', error);
      return false;
    }
  }

  // Activar plan para usuario
  async activateUserPlan(paymentId) {
    try {
      const paymentDoc = await this.db.collection('payments').doc(paymentId).get();
      const payment = paymentDoc.data();

      if (!payment) throw new Error('Pago no encontrado');

      const planLimits = {
        'Plan Pro': { maxProducts: 5000, maxUsers: 10, maxMonths: 1 },
        'Plan Empresarial': { maxProducts: 999999, maxUsers: 999999, maxMonths: 1 }
      };

      const limits = planLimits[payment.plan] || planLimits['Plan Pro'];
      const expiresAt = new Date(Date.now() + limits.maxMonths * 30 * 24 * 60 * 60 * 1000);

      // Crear registro de suscripción
      await this.db.collection('subscriptions').add({
        email: payment.email,
        plan: payment.plan,
        paymentId: paymentId,
        status: 'active',
        limits: limits,
        expiresAt: expiresAt.toISOString(),
        createdAt: new Date().toISOString()
      });

      await this.sendConfirmationEmail(payment, expiresAt);
      return true;
    } catch (error) {
      console.error('❌ Error activando plan:', error);
      return false;
    }
  }

  // Enviar email de confirmación
  async sendConfirmationEmail(payment, expiresAt) {
    try {
      if (!window.emailjs) {
        console.warn('⚠️ EmailJS no disponible');
        return false;
      }

      const emailContent = `
¡Hola ${payment.fullName}!

Tu pago de S/ ${payment.amount} ha sido registrado correctamente.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DETALLES DEL PEDIDO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• Plan: ${payment.plan}
• Monto: S/ ${payment.amount}
• Referencia: ${payment.reference}
• Método de Pago: ${payment.method}
• Válido hasta: ${new Date(expiresAt).toLocaleDateString('es-PE')}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PRÓXIMOS PASOS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Para Yape/PLIN:
✅ Tu pago se confirmará automáticamente en 24 horas
✅ Recibirás acceso a tu plan
✅ Si pasadas 24 horas no ves la activación, contactanos

Para Transferencia Bancaria:
✅ Sube el comprobante en tu panel
✅ Activaremos en máximo 2 horas laborales
✅ Envía el comprobante a: soporte@inventario.pe

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PLAN ${payment.plan.toUpperCase()}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${payment.plan === 'Plan Pro' ? `
✅ Hasta 5,000 productos
✅ Hasta 10 usuarios
✅ Histórico ilimitado
✅ Colaboradores con permisos
✅ Exportar datos a CSV
✅ Soporte prioritario
` : `
✅ Productos ilimitados
✅ Usuarios ilimitados
✅ Histórico ilimitado
✅ API personalizada
✅ Integración customizada
✅ Soporte 24/7 dedicado
`}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CONTACTO Y SOPORTE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📧 Email: soporte@inventario.pe
📱 WhatsApp: +51 999 999 999
☎️ Teléfono: +51 (01) XXXX-XXXX
⏰ Horario: Lunes a Viernes 9am - 6pm

¡Gracias por confiar en Inventario Perú! 🙏
      `;

      await emailjs.send(
        process.env.VITE_EMAILJS_SERVICE_ID,
        process.env.VITE_EMAILJS_TEMPLATE_ID,
        {
          to_email: payment.email,
          subject: `✅ Pago Registrado - ${payment.plan}`,
          message: emailContent,
          fullName: payment.fullName
        }
      );

      console.log('✅ Email de confirmación enviado a:', payment.email);
      return true;
    } catch (error) {
      console.error('❌ Error enviando email:', error);
      return false;
    }
  }

  // Verificar límites de plan
  async checkPlanLimits(email) {
    try {
      const snapshot = await this.db.collection('subscriptions')
        .where('email', '==', email)
        .where('status', '==', 'active')
        .get();

      if (snapshot.empty) {
        return {
          plan: 'free',
          limits: { maxProducts: 100, maxUsers: 1 },
          isActive: false
        };
      }

      const subscription = snapshot.docs[0].data();
      const expiresAt = new Date(subscription.expiresAt);
      const isActive = expiresAt > new Date();

      return {
        plan: subscription.plan,
        limits: subscription.limits,
        isActive: isActive,
        expiresAt: subscription.expiresAt
      };
    } catch (error) {
      console.error('❌ Error verificando límites:', error);
      return { plan: 'free', limits: { maxProducts: 100, maxUsers: 1 }, isActive: false };
    }
  }

  // Generar comprobante de pago
  generateReceipt(payment) {
    const receipt = `
╔════════════════════════════════════════╗
║     INVENTARIO PERÚ - RECIBO PAGO     ║
╚════════════════════════════════════════╝

REFERENCIA: ${payment.reference}
FECHA: ${new Date().toLocaleDateString('es-PE')}
HORA: ${new Date().toLocaleTimeString('es-PE')}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CLIENTE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Nombre: ${payment.fullName}
Correo: ${payment.email}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DESCRIPCIÓN
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Plan: ${payment.plan}
Método: ${payment.method}
Monto: S/ ${payment.amount}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ESTADO: PENDIENTE DE CONFIRMAR
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Soporte: soporte@inventario.pe
WhatsApp: +51 999 999 999

Este es un comprobante temporal. La cuenta
se activará una vez confirmado el pago.
    `;

    return receipt;
  }
}

// Instancia global
const paymentProcessor = new PaymentProcessor();

// ==================== FUNCIONES DE INTEGRACIÓN FRONTEND ====================

async function initPaymentSystem(db) {
  paymentProcessor.initializeDatabase(db);
  console.log('✅ Sistema de pagos Yape inicializado');
}

async function processYapePayment(email, plan, amount) {
  try {
    const paymentData = {
      email,
      plan,
      amount,
      method: 'yape',
      reference: `YPE-${Date.now()}`,
      fullName: email.split('@')[0]
    };

    const paymentId = await paymentProcessor.recordPayment(paymentData);
    const receipt = paymentProcessor.generateReceipt(paymentData);

    console.log('✅ Pago Yape registrado:', paymentId);
    console.log('📋 Comprobante:', receipt);

    return {
      success: true,
      paymentId,
      reference: paymentData.reference,
      receipt
    };
  } catch (error) {
    console.error('❌ Error procesando pago Yape:', error);
    return { success: false, error: error.message };
  }
}

async function verifyPlanLimits(email, productsCount, usersCount) {
  try {
    const planInfo = await paymentProcessor.checkPlanLimits(email);

    if (!planInfo.isActive) {
      return {
        allowed: false,
        message: `Tu plan ha expirado. Renovalo para continuar.`,
        expiresAt: planInfo.expiresAt
      };
    }

    const exceeded = [];
    if (productsCount > planInfo.limits.maxProducts) {
      exceeded.push(`Productos (Max: ${planInfo.limits.maxProducts})`);
    }
    if (usersCount > planInfo.limits.maxUsers) {
      exceeded.push(`Usuarios (Max: ${planInfo.limits.maxUsers})`);
    }

    return {
      allowed: exceeded.length === 0,
      message: exceeded.length > 0 ? `Límite alcanzado en: ${exceeded.join(', ')}` : 'Dentro de límites',
      plan: planInfo.plan,
      limits: planInfo.limits
    };
  } catch (error) {
    console.error('❌ Error verificando límites:', error);
    return { allowed: true };
  }
}

console.log('✅ Sistema de pagos Yape cargado correctamente');

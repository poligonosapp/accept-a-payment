import React, {useEffect, useState} from 'react';
import {
  PaymentRequestButtonElement,
  useStripe,
} from '@stripe/react-stripe-js';
import StatusMessages, {useMessages} from './StatusMessages';

const PaymentRequestForm = () => {
  const stripe = useStripe();
  const [messages, addMessage] = useMessages();
  const [paymentRequest, setPaymentRequest] = useState(null);

  useEffect(() => {
    if (stripe) {
      const pr = stripe.paymentRequest({
        country: 'US',
        currency: 'usd',
        total: {
          label: 'Demo total',
          amount: 1999,
        },
        requestPayerName: true,
        requestPayerEmail: true,
      });

      // Check the availability of the Payment Request API.
      pr.canMakePayment().then(result => {
        if (result) {
          setPaymentRequest(pr);
        }
      });
    }
  }, [stripe]);

  useEffect(() => {
    if(!paymentRequest || !stripe) {
      return;
    }

    const createAndConfirmPaymentIntent = async () => {
      // Create the payment intent on the server and pull out
      // the clientSecret to be used when the payment request button
      // successfully tokenizes the payment method.
      const {error: err, clientSecret} = await fetch('/create-payment-intent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          paymentMethodType: 'card',
          currency: 'usd',
        }),
      }).then(r => r.json());

      if(err) {
        addMessage(err.message);
        return;
      }

      addMessage('Client secret returned');

      // When the payment request button successfully tokenizes a
      // payment method.
      paymentRequest.on('paymentmethod', async (ev) => {

        // Confirm the PaymentIntent without handling potential next actions (yet).
        const {error: err, paymentIntent} = await stripe.confirmCardPayment(clientSecret,
          {
            payment_method: ev.paymentMethod.id,
          }, {
            handleActions: false,
          }
        );

        if (err) {
          // Report to the browser that the payment failed, prompting it to
          // re-show the payment interface, or show an error message and close
          // the payment interface.
          ev.complete('fail');
        } else {
          // Report to the browser that the confirmation was successful, prompting
          // it to close the browser payment method collection interface.
          ev.complete('success');
          // Check if the PaymentIntent requires any actions and if so let Stripe.js
          // handle the flow. If using an API version older than "2019-02-11" instead
          // instead check for: `paymentIntent.status === "requires_source_action"`.
          if (paymentIntent.status === 'requires_action') {
            // Let Stripe.js handle the rest of the payment flow.
            const {error} = await stripe.confirmCardPayment(clientSecret);
            if (error) {
              // The payment failed -- ask your customer for a new payment method.
              addMessage(error.message);
              return;
            }
            // The payment has succeeded.
            addMessage(`Payment ${paymentIntent.status}: ${paymentIntent.id}`);
            return;
          }
          // The payment has succeeded.
          addMessage(`Payment ${paymentIntent.status}: ${paymentIntent.id}`);
        }
      });
    }

    createAndConfirmPaymentIntent();
  }, [paymentRequest, addMessage, stripe]);

  return (
    <>
      <PaymentRequestButtonElement options={{paymentRequest}} />
      <StatusMessages messages={messages} />
    </>
  )
};

export default PaymentRequestForm;

import { useState } from 'react';

const Contact = () => {
  const [formData, setFormData] = useState({ name: '', email: '', message: '' });
  const [submitted, setSubmitted] = useState(false);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    console.log(formData);
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 3000);
  };

  return (
    <section id="contact" className="py-24 px-6 border-t border-neutral-800/50">
      <div className="max-w-lg mx-auto">
        <div className="text-center mb-12">
          <p className="text-neutral-600 text-sm tracking-[0.3em] uppercase mb-4">Contact</p>
          <h2 className="text-3xl font-light text-neutral-100">Get In Touch</h2>
        </div>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="name" className="block text-neutral-500 text-xs uppercase tracking-wider mb-2">Name</label>
            <input
              type="text" id="name" name="name" value={formData.name} onChange={handleChange}
              required autoComplete="name"
              className="w-full px-4 py-3 bg-neutral-900 border border-neutral-800 rounded-lg text-neutral-200 text-sm focus:outline-none focus:border-neutral-600 transition-colors"
            />
          </div>
          <div>
            <label htmlFor="email" className="block text-neutral-500 text-xs uppercase tracking-wider mb-2">Email</label>
            <input
              type="email" id="email" name="email" value={formData.email} onChange={handleChange}
              required autoComplete="email"
              className="w-full px-4 py-3 bg-neutral-900 border border-neutral-800 rounded-lg text-neutral-200 text-sm focus:outline-none focus:border-neutral-600 transition-colors"
            />
          </div>
          <div>
            <label htmlFor="message" className="block text-neutral-500 text-xs uppercase tracking-wider mb-2">Message</label>
            <textarea
              id="message" name="message" rows="4" value={formData.message} onChange={handleChange}
              required autoComplete="off"
              className="w-full px-4 py-3 bg-neutral-900 border border-neutral-800 rounded-lg text-neutral-200 text-sm focus:outline-none focus:border-neutral-600 transition-colors resize-none"
            />
          </div>
          <button
            type="submit"
            className="w-full py-3 border border-neutral-700 text-neutral-300 text-sm tracking-wider uppercase hover:bg-neutral-800 transition-all duration-300 rounded-lg"
          >
            Send Message
          </button>
          {submitted && (
            <p className="text-green-500/70 text-center text-sm">Message sent successfully</p>
          )}
        </form>
      </div>
    </section>
  );
};

export default Contact;
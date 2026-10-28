export const metadata = {
  title: 'TripCircle API',
  description: 'Backend API for TripCircle Expense Management',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body style={{ fontFamily: 'sans-serif', margin: 0, padding: '2rem' }}>
        {children}
      </body>
    </html>
  );
}

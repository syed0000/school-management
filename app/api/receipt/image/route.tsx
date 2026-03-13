import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';
import { format } from 'date-fns';
import { schoolConfig } from '@/lib/config';

export const runtime = 'edge';

export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const receiptNumber = searchParams.get('receiptNumber') || 'N/A';

        // Load Font
        let fontData: ArrayBuffer | null = null;
        try {
            // Using Space Mono from Google Fonts (TTF support is best for satori)
            const response = await fetch('https://github.com/google/fonts/raw/main/ofl/spacemono/SpaceMono-Regular.ttf');
            if (response.ok) {
                fontData = await response.arrayBuffer();
            } else {
                console.error('Failed to fetch font:', response.statusText);
            }
        } catch (e) {
            console.error('Error fetching font:', e);
        }

        const studentName = searchParams.get('studentName') || 'Unknown';
        const studentRegNo = searchParams.get('studentRegNo') || 'N/A';
        const rollNumber = searchParams.get('rollNumber') || 'N/A';
        const className = searchParams.get('className') || 'N/A';
        const section = searchParams.get('section') || 'A';
        const amountStr = searchParams.get('amount') || '0';
        const amount = parseFloat(amountStr);
        const dateStr = searchParams.get('date') || new Date().toISOString();
        const date = new Date(dateStr);
        const feeType = searchParams.get('feeType') || 'Fee Payment';
        const monthsStr = searchParams.get('months'); // comma separated months
        const yearStr = searchParams.get('year');
        const examType = searchParams.get('examType');
        const title = searchParams.get('title');
        // const remarks = searchParams.get('remarks'); // Unused

        // Load Logo using the request origin
        const origin = request.nextUrl.origin;
        const logoSrc = `${origin}/dark-logo.jpeg`;

        // Format fee description
        let feeDescription = 'Fee Payment';
        const year = yearStr ? parseInt(yearStr) : date.getFullYear();

        if (feeType === 'Multiple Fees') {
             feeDescription = 'Multiple Fee Items (See Detail in App)';
        } else if (feeType === 'monthly') {
            let months: number[] = [];
            if (monthsStr) {
                months = monthsStr.split(',').map(m => parseInt(m));
            }

            if (months.length > 0) {
                const monthNames = months.map(m => {
                    try {
                        return format(new Date(year, m - 1), 'MMM');
                    } catch {
                        return '';
                    }
                }).filter(Boolean).join(', ');
                feeDescription = `Monthly Fee - ${monthNames} ${year}`;
            } else {
                feeDescription = `Monthly Fee - ${format(date, 'MMM yyyy')}`;
            }
        } else if (feeType === 'examination') {
            feeDescription = `Examination Fee - ${examType || title || 'Annual'} ${year}`;
        } else if (feeType === 'admission' || feeType === 'admissionFees') {
            feeDescription = `Admission Fee - ${year}`;
        } else if (feeType === 'registrationFees') {
            feeDescription = `Registration Fee - ${year}`;
        } else if (feeType === 'other') {
            feeDescription = title || 'Other Fee';
        }

        return new ImageResponse(
            (
                <div
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        width: '100%',
                        height: '100%',
                        backgroundColor: 'white',
                        padding: '40px',
                        fontFamily: fontData ? '"Space Mono", monospace' : 'monospace',
                    }}
                >
                    {/* Header */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '20px' }}>
                        {logoSrc ? (
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img
                                src={logoSrc}
                                width="120"
                                height="120"
                                style={{
                                    marginBottom: '10px',
                                    objectFit: 'contain',
                                }}
                                alt="School Logo"
                            />
                        ) : null}
                        <h1 style={{ fontSize: '32px', fontWeight: 'bold', margin: '0', textAlign: 'center' }}>
                            {schoolConfig.name}
                        </h1>
                        <p style={{ fontSize: '18px', margin: '5px 0' }}>Fee Receipt</p>
                    </div>

                    {/* Divider */}
                    <div style={{ width: '100%', height: '2px', backgroundColor: 'black', margin: '10px 0' }}></div>

                    {/* Receipt Info */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', fontSize: '18px', marginBottom: '10px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span>Receipt No: {receiptNumber}</span>
                            <span>Date: {format(date, 'dd MMM yyyy')}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span></span>
                            <span>Time: {format(date, 'hh:mm a')}</span>
                        </div>
                    </div>

                    {/* Student Info */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '18px', marginBottom: '20px' }}>
                        <div style={{ display: 'flex' }}>
                            <span style={{ fontWeight: 'bold', width: '150px' }}>Student Name:</span>
                            <span>{studentName}</span>
                        </div>
                        <div style={{ display: 'flex' }}>
                            <span style={{ fontWeight: 'bold', width: '150px' }}>Reg. No:</span>
                            <span>{studentRegNo}</span>
                        </div>
                        <div style={{ display: 'flex' }}>
                            <span style={{ fontWeight: 'bold', width: '150px' }}>Class / Sec:</span>
                            <span>{className} - {section}</span>
                        </div>
                        <div style={{ display: 'flex' }}>
                            <span style={{ fontWeight: 'bold', width: '150px' }}>Roll No:</span>
                            <span>{rollNumber}</span>
                        </div>
                    </div>

                    {/* Divider */}
                    <div style={{ width: '100%', height: '1px', backgroundColor: '#ccc', margin: '10px 0' }}></div>

                    {/* Fee Details */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '18px', marginBottom: '20px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span>{feeDescription}</span>
                            <span>₹{amount.toLocaleString()}</span>
                        </div>
                    </div>

                    {/* Total */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '24px', fontWeight: 'bold', marginTop: '20px', borderTop: '2px solid black', paddingTop: '10px' }}>
                        <span>GRAND TOTAL:</span>
                        <span>₹{amount.toLocaleString()}</span>
                    </div>

                    {/* Hindi Notes */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', marginBottom: '20px', alignItems: 'flex-start', marginTop: '36px', fontSize: '16px', color: '#666', }}>
                        <p style={{ margin: 0 }}>कृपया समय पर फीस जमा करें</p>
                        <p style={{ margin: 0 }}>कृपया बच्चे की फीस जमा करते समय डायरी अपने साथ लाये</p>
                        <p style={{ margin: 0 }}>कृपया अपने बच्चे को पढ़ाई में सहयोग करें</p>
                        <p style={{ margin: 0 }}>बच्चे को समय पर स्कूल भेजे</p>
                    </div>

                    {/* Footer */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: 'auto', fontSize: '14px', color: '#666', textAlign: 'center' }}>
                        <p style={{ fontWeight: 'bold', marginBottom: '5px' }}>Thank You!</p>
                        <p>Generated by Fee Ease School System by Cod Vista</p>
                    </div>
                </div>
            ),
            {
                width: 600,
                height: 900,
                fonts: fontData ? [
                    {
                        name: 'Space Mono',
                        data: fontData,
                        style: 'normal',
                    },
                ] : undefined,
                emoji: 'twemoji',
            }
        );
    } catch (error) {
        console.error('Error generating receipt image:', error);
        return new Response('Failed to generate receipt image', { status: 500 });
    }
}

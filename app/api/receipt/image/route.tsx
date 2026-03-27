import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';
import { format } from 'date-fns';
import { schoolConfig } from '@/lib/config';

export const runtime = 'edge';

export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const receiptNumber = searchParams.get('receiptNumber') || 'N/A';
        const origin = request.nextUrl.origin;

        // Load Fonts
        let monoFontData: ArrayBuffer | null = null;
        let devanagariFontData: ArrayBuffer | null = null;

        try {
            // Fetch Space Mono for the "monospace" look the user wants
            const monoRes = await fetch('https://github.com/google/fonts/raw/main/ofl/spacemono/SpaceMono-Regular.ttf');
            if (monoRes.ok) monoFontData = await monoRes.arrayBuffer();

            // Fetch Noto Sans Devanagari for Hindi support
            const devRes = await fetch('https://fonts.gstatic.com/s/notosansdevanagari/v23/6nKbX6mP7s7Z59N26m6h8vNs_P-L8f1H2w.ttf');
            if (devRes.ok) devanagariFontData = await devRes.arrayBuffer();
        } catch (e) {
            console.error('Error fetching fonts:', e);
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

        // Load Logo using the request origin
        const logoSrc = `${origin}/dark-logo.jpeg`;
        let logoDataUri: string | null = null;
        try {
            const logoRes = await fetch(logoSrc);
            if (logoRes.ok) {
                const arrayBuffer = await logoRes.arrayBuffer();
                const base64 = Buffer.from(arrayBuffer).toString('base64');
                const contentType = logoRes.headers.get('content-type') || 'image/jpeg';
                logoDataUri = `data:${contentType};base64,${base64}`;
            }
        } catch (e) {
            console.error('Error loading logo:', e);
        }

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

        // Font family string - Space Mono first for Latin, then Noto Sans Devanagari
        const fontFamily = [
            monoFontData ? '"Space Mono"' : '',
            devanagariFontData ? '"Noto Sans Devanagari"' : '',
            'monospace'
        ].filter(Boolean).join(', ');

        return new ImageResponse(
            (
                <div
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        width: '100%',
                        height: '100%',
                        backgroundColor: 'white',
                        padding: '30px 40px', // Reduced top/bottom padding
                        fontFamily: fontFamily,
                    }}
                >
                    {/* Header */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '15px' }}>
                        {logoDataUri ? (
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img
                                src={logoDataUri}
                                width={80} // Slightly smaller logo to save space
                                height={80}
                                style={{
                                    marginBottom: '8px',
                                    objectFit: 'contain',
                                }}
                                alt="School Logo"
                            />
                        ) : null}
                        <h1 style={{ fontSize: '28px', fontWeight: 'bold', margin: '0', textAlign: 'center' }}>
                            {schoolConfig.name}
                        </h1>
                        <p style={{ fontSize: '16px', margin: '4px 0', borderBottom: '1px solid #ddd', paddingBottom: '4px' }}>Fee Receipt</p>
                    </div>

                    {/* Receipt Info */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '16px', marginBottom: '10px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span>Receipt# {receiptNumber}</span>
                            <span>{format(date, 'dd MMM yyyy')}</span>
                        </div>
                    </div>

                    {/* Student Info */}
                    <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px',
                        fontSize: '17px',
                        marginBottom: '15px',
                        backgroundColor: '#f9f9f9',
                        padding: '12px 15px',
                        borderRadius: '8px',
                        border: '1px solid #eee'
                    }}>
                        <div style={{ display: 'flex' }}>
                            <span style={{ fontWeight: 'bold', width: '160px' }}>Student:</span>
                            <span>{studentName}</span>
                        </div>
                        <div style={{ display: 'flex' }}>
                            <span style={{ fontWeight: 'bold', width: '160px' }}>Reg ID / Roll:</span>
                            <span>{studentRegNo} / {rollNumber}</span>
                        </div>
                        <div style={{ display: 'flex' }}>
                            <span style={{ fontWeight: 'bold', width: '160px' }}>Class / Sec:</span>
                            <span>{className} - {section}</span>
                        </div>
                    </div>

                    {/* Fee Details */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '17px', marginBottom: '8px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #eee', paddingBottom: '6px' }}>
                            <span style={{ fontWeight: 'bold' }}>Description</span>
                            <span style={{ fontWeight: 'bold' }}>Amount</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
                            <span style={{ fontSize: '16px' }}>{feeDescription}</span>
                            <span>₹{amount.toLocaleString()}</span>
                        </div>
                    </div>

                    {/* Total */}
                    <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        fontSize: '22px',
                        fontWeight: 'bold',
                        marginTop: '8px',
                        borderTop: '2px solid black',
                        paddingTop: '8px',
                        color: '#000'
                    }}>
                        <span>TOTAL PAID</span>
                        <span>₹{amount.toLocaleString()}</span>
                    </div>

                    {/* Hindi Notes */}
                    <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '3px',
                        marginBottom: '10px',
                        alignItems: 'flex-start',
                        marginTop: '20px',
                        fontSize: '14px', // Reduced font size for notes
                        color: '#444',
                        lineHeight: '1.3'
                    }}>
                        <p style={{ margin: 0 }}>• कृपया समय पर फीस जमा करें</p>
                        <p style={{ margin: 0 }}>• कृपया फीस जमा करते समय डायरी साथ लाएं</p>
                        <p style={{ margin: 0 }}>• कृपया बच्चे की पढ़ाई में सहयोग करें</p>
                        <p style={{ margin: 0 }}>• बच्चे को नियमित और समय पर स्कूल भेजें</p>
                    </div>

                    {/* Footer */}
                    <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        marginTop: 'auto',
                        fontSize: '12px',
                        color: '#666',
                        textAlign: 'center',
                        borderTop: '1px dashed #ccc',
                        paddingTop: '8px',
                        paddingBottom: '5px' // Extra padding for safety
                    }}>
                        <p style={{ fontWeight: 'bold', margin: '0 0 1px 0' }}>Thank You!</p>
                        <p style={{ margin: 0 }}>Generated via FeeEase System | feeease.com</p>
                    </div>
                </div>
            ),
            {
                width: 800,
                height: 800,
                fonts: [
                    ...(monoFontData ? [{
                        name: 'Space Mono',
                        data: monoFontData,
                        style: 'normal' as const,
                    }] : []),
                    ...(devanagariFontData ? [{
                        name: 'Noto Sans Devanagari',
                        data: devanagariFontData,
                        style: 'normal' as const,
                    }] : []),
                ],
                emoji: 'twemoji',
            }
        );
    } catch (error) {
        console.error('Error generating receipt image:', error);
        return new Response('Error rendering receipt image', { status: 500 });
    }
}


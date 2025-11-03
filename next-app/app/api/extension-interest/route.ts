import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';

/**
 * POST /api/extension-interest
 * Register user interest in IDE extensions
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, ide_preference } = body;

    // Validate input
    if (!email || typeof email !== 'string') {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    if (!ide_preference || typeof ide_preference !== 'string') {
      return NextResponse.json(
        { error: 'IDE preference is required' },
        { status: 400 }
      );
    }

    // Validate IDE preference
    const validIDEs = ['vscode', 'jetbrains', 'vim', 'other'];
    if (!validIDEs.includes(ide_preference)) {
      return NextResponse.json(
        { error: 'Invalid IDE preference' },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      );
    }

    // Create Supabase client
    const supabase = createServerSupabaseClient(request);

    // Get current user (if logged in)
    const { data: { user } } = await supabase.auth.getUser();

    // Check if interest already registered
    const { data: existing, error: checkError } = await supabase
      .from('extension_interest')
      .select('id')
      .eq('email', email)
      .eq('ide_preference', ide_preference)
      .maybeSingle();

    if (checkError && checkError.code !== 'PGRST116') {
      console.error('Error checking existing interest:', checkError);
      return NextResponse.json(
        { error: 'Failed to check existing interest' },
        { status: 500 }
      );
    }

    // If already exists, return success (idempotent)
    if (existing) {
      return NextResponse.json({
        success: true,
        message: 'Interest already registered',
        already_registered: true,
      });
    }

    // Insert interest record
    const { data, error } = await supabase
      .from('extension_interest')
      .insert({
        email,
        ide_preference,
        user_id: user?.id || null,
      })
      .select()
      .single();

    if (error) {
      console.error('Error inserting interest:', error);
      return NextResponse.json(
        { error: 'Failed to register interest' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Interest registered successfully',
      data,
    });
  } catch (error) {
    console.error('Error in extension-interest API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/extension-interest
 * Get user's registered interests (requires authentication)
 */
export async function GET(request: NextRequest) {
  try {
    // Create Supabase client
    const supabase = createServerSupabaseClient(request);

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Fetch user's interests
    const { data, error } = await supabase
      .from('extension_interest')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching interests:', error);
      return NextResponse.json(
        { error: 'Failed to fetch interests' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error('Error in extension-interest GET API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}


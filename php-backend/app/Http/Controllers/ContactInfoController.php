<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ContactInfoController extends Controller
{
    public function index(Request $request)
    {
        try {
            $active = $request->query('active');

            $query = DB::table('contact_info')->whereRaw('1=1');

            if ($active !== null && $active !== '') {
                $query->where('is_active', $active === 'true' || $active === 1 || $active === '1');
            }

            $contact = $query
                ->orderByDesc('created_at')
                ->first();

            if (!$contact) {
                return response()->json(null);
            }

            return response()->json($contact);
        } catch (\Throwable $e) {
            return response()->json(['error' => 'Internal server error'], 500);
        }
    }

    public function store(Request $request)
    {
        try {
            $email = $request->input('email');
            $whatsapp = $request->input('whatsapp');
            $description = $request->input('description');
            $isActive = $request->input('is_active', true);

            if (!$email || !$whatsapp) {
                return response()->json(['error' => 'Email and WhatsApp are required'], 400);
            }

            DB::table('contact_info')
                ->where('is_active', true)
                ->update(['is_active' => false]);

            $id = DB::table('contact_info')->insertGetId([
                'email' => $email,
                'whatsapp' => $whatsapp,
                'description' => $description ?: null,
                'is_active' => (bool) $isActive,
            ]);

            return response()->json([
                'id' => $id,
                'message' => 'Contact info created successfully',
            ], 201);
        } catch (\Throwable $e) {
            return response()->json(['error' => 'Internal server error'], 500);
        }
    }

    public function update($id, Request $request)
    {
        try {
            $email = $request->input('email');
            $whatsapp = $request->input('whatsapp');
            $description = $request->input('description');
            $isActive = $request->input('is_active');

            $updates = [];

            if ($email !== null) {
                $updates['email'] = $email;
            }

            if ($whatsapp !== null) {
                $updates['whatsapp'] = $whatsapp;
            }

            if ($description !== null) {
                $updates['description'] = $description;
            }

            if ($isActive !== null) {
                $activeBool = (bool) $isActive;
                if ($activeBool) {
                    DB::table('contact_info')
                        ->where('id', '!=', $id)
                        ->update(['is_active' => false]);
                }
                $updates['is_active'] = $activeBool;
            }

            if (!empty($updates)) {
                DB::table('contact_info')
                    ->where('id', $id)
                    ->update($updates);
            }

            return response()->json(['message' => 'Contact info updated successfully']);
        } catch (\Throwable $e) {
            return response()->json(['error' => 'Internal server error'], 500);
        }
    }

    public function destroy($id)
    {
        try {
            DB::table('contact_info')
                ->where('id', $id)
                ->delete();

            return response()->json(['message' => 'Contact info deleted successfully']);
        } catch (\Throwable $e) {
            return response()->json(['error' => 'Internal server error'], 500);
        }
    }
}


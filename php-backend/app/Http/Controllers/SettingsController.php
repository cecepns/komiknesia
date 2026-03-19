<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class SettingsController extends Controller
{
    protected array $validIntervals = [10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60];

    public function show()
    {
        try {
            $rows = DB::table('settings')
                ->select('key', 'value')
                ->whereIn('key', ['popup_ads_interval_minutes', 'home_popup_interval_minutes'])
                ->get();

            $map = [];
            foreach ($rows as $row) {
                $map[$row->key] = $row->value;
            }

            $popupAds = (int) ($map['popup_ads_interval_minutes'] ?? 0);
            $homePopup = (int) ($map['home_popup_interval_minutes'] ?? 0);

            $popupAds = in_array($popupAds, $this->validIntervals, true) ? $popupAds : 20;
            $homePopup = in_array($homePopup, $this->validIntervals, true) ? $homePopup : 30;

            return response()->json([
                'popup_ads_interval_minutes' => $popupAds,
                'home_popup_interval_minutes' => $homePopup,
            ]);
        } catch (\Throwable $e) {
            return response()->json([
                'popup_ads_interval_minutes' => 20,
                'home_popup_interval_minutes' => 30,
            ]);
        }
    }

    public function update(Request $request)
    {
        try {
            $popup = $request->input('popup_ads_interval_minutes');
            $home = $request->input('home_popup_interval_minutes');

            $set = function (string $key, $value) {
                $v = (int) $value;
                if (!in_array($v, $this->validIntervals, true)) {
                    return;
                }

                DB::table('settings')->updateOrInsert(
                    ['key' => $key],
                    ['value' => (string) $v]
                );
            };

            if ($popup !== null) {
                $set('popup_ads_interval_minutes', $popup);
            }

            if ($home !== null) {
                $set('home_popup_interval_minutes', $home);
            }

            return response()->json(['message' => 'Settings updated']);
        } catch (\Throwable $e) {
            return response()->json(['error' => 'Internal server error'], 500);
        }
    }
}

